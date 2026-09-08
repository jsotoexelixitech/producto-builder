import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CoreSyncStatus,
  EmissionType,
  Prisma,
  ProductBranch,
  ProductStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PartnerBridgeService } from '../partner-bridge/partner-bridge.service';
import {
  mapProductToPartnerPayload,
  resolveCproducto,
  dtoToPartnerPayload,
  rowToPartnerForm,
} from '../partner-bridge/partner-product.mapper';
import { Sis2000ProductDto } from './dto/sis2000.dto';
import {
  normalizeSis2000Plan,
  normalizeSis2000PlanList,
} from './sis2000-plans';
import {
  BRANCH_CORE_RAMO,
  DEFAULT_CORE_COVERAGES,
  DEFAULT_SUB_BRANCHES,
} from './core.constants';
import { CreateCoreCoverageDto } from './dto/core.dto';

@Injectable()
export class CoreService implements OnModuleInit {
  private readonly logger = new Logger(CoreService.name);
  private readonly coreApiUrl: string;
  private readonly coreApiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly partnerBridge: PartnerBridgeService,
  ) {
    this.coreApiUrl = (process.env.CORE_API_URL ?? '').replace(/\/$/, '');
    this.coreApiKey = process.env.CORE_API_KEY ?? '';
  }

  async onModuleInit() {
    await this.ensureCatalogSeed();
  }

  async listSubBranches(branch: ProductBranch) {
    await this.ensureCatalogSeed();
    const remote = await this.fetchRemoteSubBranches(branch).catch(() => null);
    if (remote?.length) return remote;

    return this.prisma.coreSubBranch.findMany({
      where: { branch, isActive: true },
      orderBy: { name: 'asc' },
      select: {
        code: true,
        name: true,
        coreRamoCode: true,
        branch: true,
      },
    });
  }

  async listCoverages(branch: ProductBranch, subBranchCode?: string) {
    await this.ensureCatalogSeed();
    const remote = await this.fetchRemoteCoverages(branch, subBranchCode).catch(
      () => null,
    );
    if (remote?.length) return remote;

    return this.prisma.coreCoverageCatalog.findMany({
      where: {
        branch,
        isActive: true,
        ...(subBranchCode
          ? { OR: [{ subBranchCode }, { subBranchCode: null }] }
          : {}),
      },
      orderBy: { name: 'asc' },
      select: {
        code: true,
        name: true,
        accountingCode: true,
        subBranchCode: true,
        branch: true,
        source: true,
      },
    });
  }

  async createCoverage(dto: CreateCoreCoverageDto) {
    await this.ensureCatalogSeed();
    const ramo = BRANCH_CORE_RAMO[dto.branch];
    const code =
      dto.code?.toUpperCase() ||
      this.slugCode(dto.name, dto.branch);

    const existing = await this.prisma.coreCoverageCatalog.findUnique({
      where: { branch_code: { branch: dto.branch, code } },
    });
    if (existing) {
      throw new BadRequestException(
        `Ya existe la cobertura CORE ${code} en el ramo ${dto.branch}.`,
      );
    }

    const created = await this.prisma.coreCoverageCatalog.create({
      data: {
        branch: dto.branch,
        subBranchCode: dto.subBranchCode || null,
        code,
        name: dto.name.trim(),
        accountingCode: dto.accountingCode || null,
        source: this.coreApiUrl ? 'LOCAL+CORE' : 'LOCAL',
      },
    });

    if (this.coreApiUrl) {
      await this.pushCoverageToRemote({
        cramo: ramo.code,
        subBranchCode: dto.subBranchCode,
        code,
        name: dto.name,
        accountingCode: dto.accountingCode,
      }).catch((err) => {
        this.logger.warn(`CORE remoto no disponible al crear cobertura: ${err}`);
      });
    }

    return {
      code: created.code,
      name: created.name,
      accountingCode: created.accountingCode,
      subBranchCode: created.subBranchCode,
      branch: created.branch,
      source: created.source,
    };
  }

  async listCoreProducts(branch?: ProductBranch) {
    if (this.partnerBridge.isConfigured()) {
      try {
        return await this.partnerBridge.listCoreProductSummaries(branch);
      } catch (err) {
        this.logger.warn(`Partner list no disponible: ${err}`);
      }
    }

    const remote = await this.fetchRemoteProducts(branch).catch(() => null);
    if (remote?.length) return remote;

    return this.prisma.coreProductRegistry.findMany({
      where: branch ? { branch } : undefined,
      orderBy: { syncedAt: 'desc' },
      select: {
        coreCode: true,
        commercialName: true,
        internalCode: true,
        branch: true,
        subBranchCode: true,
        syncedAt: true,
        source: true,
        productId: true,
      },
    });
  }

  async syncProductToCore(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        coverages: { orderBy: { sortOrder: 'asc' } },
        productPlans: { orderBy: { sortOrder: 'asc' } },
        actuarialData: true,
        sisipConfig: true,
        commercialChannels: true,
      },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const ramo = BRANCH_CORE_RAMO[product.branch];
    const legacyCoreCode =
      product.coreProductCode ||
      `${ramo.code}-${product.internalCode}`.toUpperCase();
    const sis2000Code = resolveCproducto(
      product.coreProductCode,
      product.internalCode,
    );

    const payload = this.buildCorePayload(product, ramo.code);
    const partnerPayload = mapProductToPartnerPayload(product, sis2000Code);

    await this.prisma.product.update({
      where: { id: productId },
      data: { coreSyncStatus: CoreSyncStatus.PENDING, coreSyncError: null },
    });

    try {
      let remotePartner = false;
      let remoteCore = false;
      let partnerAction: 'created' | 'updated' | null = null;
      let coreCode = legacyCoreCode;

      if (this.partnerBridge.isConfigured()) {
        partnerAction = await this.partnerBridge.syncProduct(partnerPayload);
        coreCode = sis2000Code;
        remotePartner = true;
      }

      if (this.coreApiUrl) {
        await this.pushProductToRemote(coreCode, payload);
        remoteCore = true;
      }

      const source = remotePartner
        ? 'SIS2000'
        : remoteCore
          ? 'CORE'
          : 'LOCAL';

      await this.prisma.coreProductRegistry.upsert({
        where: { coreCode },
        create: {
          coreCode,
          productId,
          branch: product.branch,
          subBranchCode: product.subBranchCode,
          commercialName: product.commercialName,
          internalCode: product.internalCode,
          payload: {
            ...payload,
            partner: partnerPayload,
          } as unknown as Prisma.InputJsonValue,
          source,
        },
        update: {
          productId,
          branch: product.branch,
          subBranchCode: product.subBranchCode,
          commercialName: product.commercialName,
          internalCode: product.internalCode,
          payload: {
            ...payload,
            partner: partnerPayload,
          } as unknown as Prisma.InputJsonValue,
          syncedAt: new Date(),
          source,
        },
      });

      const updated = await this.prisma.product.update({
        where: { id: productId },
        data: {
          coreProductCode: coreCode,
          coreSyncedAt: new Date(),
          coreSyncStatus: CoreSyncStatus.SYNCED,
          coreSyncError: null,
        },
        include: { coverages: true, productPlans: true },
      });

      return {
        ok: true,
        coreCode,
        product: updated,
        remote: remotePartner || remoteCore,
        partner: remotePartner,
        partnerAction,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido al sincronizar';
      await this.prisma.product.update({
        where: { id: productId },
        data: {
          coreSyncStatus: CoreSyncStatus.FAILED,
          coreSyncError: message.slice(0, 500),
        },
      });
      throw new BadGatewayException(message);
    }
  }

  async importProductFromCore(coreCode: string) {
    let entry = await this.prisma.coreProductRegistry.findUnique({
      where: { coreCode },
    });

    if (!entry && this.coreApiUrl) {
      const remote = await this.fetchRemoteProduct(coreCode);
      if (remote) {
        entry = await this.prisma.coreProductRegistry.create({
          data: {
            coreCode,
            branch: remote.branch as ProductBranch,
            subBranchCode: remote.subBranchCode ?? null,
            commercialName: remote.commercialName,
            internalCode: remote.internalCode,
            payload: remote.payload as Prisma.InputJsonValue,
            source: 'CORE',
          },
        });
      }
    }

    if (!entry) {
      throw new NotFoundException(
        `Producto CORE ${coreCode} no encontrado. Sincroniza primero o verifica CORE_API_URL.`,
      );
    }

    if (entry.productId) {
      const linked = await this.prisma.product.findUnique({
        where: { id: entry.productId },
      });
      if (linked) {
        return { imported: false, product: linked, coreCode };
      }
    }

    const payload = entry.payload as Record<string, unknown>;
    const branch = entry.branch;
    const isUniform =
      branch === ProductBranch.RCV_OBLIGATORIO ||
      branch === ProductBranch.INCLUSIVO;

    const internalCode = await this.uniqueInternalCode(entry.internalCode);

    const product = await this.prisma.product.create({
      data: {
        commercialName: entry.commercialName,
        internalCode,
        branch,
        subBranchCode: entry.subBranchCode,
        subBranchName:
          typeof payload.subBranchName === 'string'
            ? payload.subBranchName
            : null,
        currency: (payload.currency as Prisma.ProductCreateInput['currency']) ?? 'VES',
        emissionType:
          (payload.emissionType as EmissionType) ??
          EmissionType.EMISION_GARANTIZADA,
        coreProductCode: coreCode,
        coreSyncedAt: entry.syncedAt,
        coreSyncStatus: CoreSyncStatus.SYNCED,
        simplifiedContract: isUniform,
        uniformConditions: isUniform,
        lockedGeneralConditions: branch === ProductBranch.RCV_OBLIGATORIO,
        stateHistory: {
          create: {
            toStatus: ProductStatus.DRAFT,
            comment: `Importado desde CORE (${coreCode})`,
          },
        },
        coverages: {
          create: this.coveragesFromPayload(payload),
        },
      },
      include: { coverages: true },
    });

    await this.prisma.coreProductRegistry.update({
      where: { coreCode },
      data: { productId: product.id },
    });

    return { imported: true, product, coreCode };
  }

  async listSis2000Products() {
    this.assertPartnerConfigured();
    const rows = await this.partnerBridge.listProducts();
    return rows.map((row) => rowToPartnerForm(row));
  }

  async getSis2000Product(cproducto: string) {
    this.assertPartnerConfigured();
    const row = await this.partnerBridge.getProductDetail(cproducto);
    return rowToPartnerForm(row);
  }

  async createSis2000Product(dto: Sis2000ProductDto) {
    this.assertPartnerConfigured();
    const payload = dtoToPartnerPayload(dto as unknown as Record<string, unknown>);
    await this.partnerBridge.createProduct(payload);
    const row = await this.partnerBridge.getProductDetail(payload.cproducto);
    return { ok: true, action: 'created' as const, product: rowToPartnerForm(row) };
  }

  async updateSis2000Product(cproducto: string, dto: Sis2000ProductDto) {
    this.assertPartnerConfigured();
    const payload = dtoToPartnerPayload({
      ...(dto as unknown as Record<string, unknown>),
      cproducto,
    });
    await this.partnerBridge.updateProduct(cproducto, payload);
    const row = await this.partnerBridge.getProductDetail(cproducto);
    return { ok: true, action: 'updated' as const, product: rowToPartnerForm(row) };
  }

  async listSis2000ProductPlans(
    cproducto: string,
    centidad?: string,
    citem?: string,
  ) {
    this.assertPartnerConfigured();
    const entity = (centidad ?? process.env.SIS2000_CENTIDAD ?? 'P').trim().toUpperCase();
    const item = (citem ?? process.env.SIS2000_CITEM ?? '80080').trim();
    const { plans, mensaje } = await this.partnerBridge.listProductPlans(
      cproducto.trim(),
      entity,
      item,
    );
    return {
      cproducto: cproducto.trim(),
      centidad: entity,
      citem: item,
      mensaje,
      plans: normalizeSis2000PlanList(plans),
    };
  }

  async getSis2000PlanDetail(cramo: number, cplan: string) {
    this.assertPartnerConfigured();
    const rows = await this.partnerBridge.getPlanDetail(cramo, cplan.trim());
    if (!rows.length) {
      throw new NotFoundException(
        `No se encontró detalle para el plan ${cplan} (ramo ${cramo}).`,
      );
    }
    return { plan: normalizeSis2000Plan(rows[0]) };
  }

  private assertPartnerConfigured() {
    if (!this.partnerBridge.isConfigured()) {
      throw new ServiceUnavailableException(
        'NEST_API_KEY no configurado. Use una key nest-api con scope partner:products.',
      );
    }
  }

  private buildCorePayload(
    product: Prisma.ProductGetPayload<{
      include: {
        coverages: true;
        productPlans: true;
        actuarialData: true;
        sisipConfig: true;
      };
    }>,
    coreRamoCode: string,
  ) {
    return {
      coreRamoCode,
      commercialName: product.commercialName,
      internalCode: product.internalCode,
      branch: product.branch,
      subBranchCode: product.subBranchCode,
      subBranchName: product.subBranchName,
      currency: product.currency,
      emissionType: product.emissionType,
      renewalFrequency: product.renewalFrequency,
      renewalType: product.renewalType,
      catalogVisible: product.catalogVisible,
      coverages: product.coverages.map((c) => ({
        code: c.coberturaInternaCode ?? c.accountingCode,
        name: c.name,
        isBasicMandatory: c.isBasicMandatory,
        insuredSumFixed: c.insuredSumFixed ? Number(c.insuredSumFixed) : null,
        premiumCalculationType: c.premiumCalculationType,
        tariffPremium: c.tariffPremium ? Number(c.tariffPremium) : null,
        tariffRate: c.tariffRate ? Number(c.tariffRate) : null,
        subLimitPercent: c.subLimitPercent ? Number(c.subLimitPercent) : null,
        accountingCode: c.accountingCode,
        dependsOnCoverageName: c.dependsOnCoverageName,
      })),
      plans: product.productPlans.map((p) => ({
        name: p.name,
        priceFactor: Number(p.priceFactor),
        isRecommended: p.isRecommended,
        coverageIds: p.coverageIds,
      })),
      actuarial: product.actuarialData
        ? {
            commercialPremium: Number(product.actuarialData.commercialPremium),
            commissions: Number(product.actuarialData.commissions),
          }
        : null,
      sisip: product.sisipConfig,
    };
  }

  private coveragesFromPayload(payload: Record<string, unknown>) {
    const list = payload.coverages;
    if (!Array.isArray(list) || list.length === 0) {
      return [
        {
          name: 'Cobertura importada',
          isBasicMandatory: true,
          premiumCalculationType: 'PRIMA_FIJA' as const,
          sortOrder: 0,
        },
      ];
    }

    return list.map((raw, index) => {
      const c = raw as Record<string, unknown>;
      return {
        name: String(c.name ?? `Cobertura ${index + 1}`),
        isBasicMandatory: Boolean(c.isBasicMandatory),
        insuredSumFixed:
          c.insuredSumFixed != null ? Number(c.insuredSumFixed) : undefined,
        premiumCalculationType:
          (c.premiumCalculationType as 'PRIMA_FIJA' | 'TASA_PORCENTUAL') ??
          'PRIMA_FIJA',
        tariffPremium:
          c.tariffPremium != null ? Number(c.tariffPremium) : undefined,
        tariffRate: c.tariffRate != null ? Number(c.tariffRate) : undefined,
        subLimitPercent:
          c.subLimitPercent != null ? Number(c.subLimitPercent) : undefined,
        accountingCode:
          typeof c.accountingCode === 'string' ? c.accountingCode : undefined,
        coberturaInternaCode:
          typeof c.code === 'string' ? c.code : undefined,
        dependsOnCoverageName:
          typeof c.dependsOnCoverageName === 'string'
            ? c.dependsOnCoverageName
            : undefined,
        sortOrder: index,
      };
    });
  }

  private async uniqueInternalCode(base: string) {
    let code = base.toUpperCase().replace(/[^A-Z0-9_-]/g, '_').slice(0, 50);
    if (code.length < 2) code = 'CORE_IMPORT';
    let attempt = code;
    let n = 1;
    while (
      await this.prisma.product.findUnique({ where: { internalCode: attempt } })
    ) {
      attempt = `${code}_${n++}`.slice(0, 50);
    }
    return attempt;
  }

  private slugCode(name: string, branch: ProductBranch) {
    const base = name
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24);
    return `${branch.slice(0, 3)}-${base || 'COV'}`.slice(0, 30);
  }

  private async ensureCatalogSeed() {
    const subCount = await this.prisma.coreSubBranch.count();
    if (subCount === 0) {
      for (const row of DEFAULT_SUB_BRANCHES) {
        const ramo = BRANCH_CORE_RAMO[row.branch];
        await this.prisma.coreSubBranch.create({
          data: {
            branch: row.branch,
            coreRamoCode: ramo.code,
            code: row.code,
            name: row.name,
          },
        });
      }
    }

    const covCount = await this.prisma.coreCoverageCatalog.count();
    if (covCount === 0) {
      for (const row of DEFAULT_CORE_COVERAGES) {
        await this.prisma.coreCoverageCatalog.create({
          data: {
            branch: row.branch,
            subBranchCode: row.subBranchCode ?? null,
            code: row.code,
            name: row.name,
            accountingCode: row.accountingCode ?? null,
          },
        });
      }
    }
  }

  private coreHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.coreApiKey) headers['x-api-key'] = this.coreApiKey;
    return headers;
  }

  private async fetchRemoteSubBranches(branch: ProductBranch) {
    if (!this.coreApiUrl) return null;
    const ramo = BRANCH_CORE_RAMO[branch];
    const res = await fetch(
      `${this.coreApiUrl}/catalog/subramos?cramo=${encodeURIComponent(ramo.code)}`,
      { headers: this.coreHeaders() },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{
      code: string;
      name: string;
      coreRamoCode?: string;
    }>;
    return data.map((row) => ({
      code: row.code,
      name: row.name,
      coreRamoCode: row.coreRamoCode ?? ramo.code,
      branch,
    }));
  }

  private async fetchRemoteCoverages(
    branch: ProductBranch,
    subBranchCode?: string,
  ) {
    if (!this.coreApiUrl) return null;
    const ramo = BRANCH_CORE_RAMO[branch];
    const qs = new URLSearchParams({ cramo: ramo.code });
    if (subBranchCode) qs.set('subramo', subBranchCode);
    const res = await fetch(`${this.coreApiUrl}/catalog/coverages?${qs}`, {
      headers: this.coreHeaders(),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{
      code: string;
      name: string;
      accountingCode?: string;
      subBranchCode?: string;
    }>;
    return data.map((row) => ({
      code: row.code,
      name: row.name,
      accountingCode: row.accountingCode ?? null,
      subBranchCode: row.subBranchCode ?? subBranchCode ?? null,
      branch,
      source: 'CORE',
    }));
  }

  private async pushCoverageToRemote(body: Record<string, unknown>) {
    const res = await fetch(`${this.coreApiUrl}/catalog/coverages`, {
      method: 'POST',
      headers: this.coreHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`CORE catalog/coverages HTTP ${res.status}`);
    }
  }

  private async fetchRemoteProducts(branch?: ProductBranch) {
    if (!this.coreApiUrl) return null;
    const qs = branch
      ? `?branch=${encodeURIComponent(branch)}`
      : '';
    const res = await fetch(`${this.coreApiUrl}/products${qs}`, {
      headers: this.coreHeaders(),
    });
    if (!res.ok) return null;
    return (await res.json()) as Array<Record<string, unknown>>;
  }

  private async fetchRemoteProduct(coreCode: string) {
    const res = await fetch(
      `${this.coreApiUrl}/products/${encodeURIComponent(coreCode)}`,
      { headers: this.coreHeaders() },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    return {
      branch: String(data.branch ?? 'PATRIMONIAL') as ProductBranch,
      subBranchCode:
        typeof data.subBranchCode === 'string' ? data.subBranchCode : undefined,
      commercialName: String(data.commercialName ?? coreCode),
      internalCode: String(data.internalCode ?? coreCode),
      payload: data.payload ?? data,
    };
  }

  private async pushProductToRemote(
    coreCode: string,
    payload: Record<string, unknown>,
  ) {
    const res = await fetch(`${this.coreApiUrl}/products`, {
      method: 'POST',
      headers: this.coreHeaders(),
      body: JSON.stringify({ coreCode, ...payload }),
    });
    if (!res.ok) {
      throw new Error(`CORE products HTTP ${res.status}`);
    }
  }
}
