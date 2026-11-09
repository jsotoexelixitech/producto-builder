import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  Cambio,
  EntidadRespaldo,
  RespaldoRepo,
  RespaldoRow,
  TipoVersion,
  UsuarioCambio,
  VersionRow,
} from './respaldo.types';

/** null de JS → NULL de la columna JSON (Prisma exige DbNull). */
const json = (v: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull =>
  v === undefined || v === null ? Prisma.DbNull : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue);

const quien = (u?: UsuarioCambio) => ({
  usuarioId: u?.id ?? null,
  usuarioEmail: u?.email ?? null,
  usuarioNombre: u?.nombre ?? null,
});

const esDuplicado = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

@Injectable()
export class PrismaRespaldoRepo implements RespaldoRepo {
  constructor(private readonly prisma: PrismaService) {}

  async buscar(entidad: EntidadRespaldo, clave: string) {
    return (await this.prisma.sis2000Respaldo.findUnique({
      where: { entidad_clave: { entidad, clave } },
    })) as RespaldoRow | null;
  }

  async asegurarOriginal(d: {
    entidad: EntidadRespaldo;
    clave: string;
    existia: boolean;
    original: unknown;
    usuario?: UsuarioCambio;
  }) {
    const existente = await this.buscar(d.entidad, d.clave);
    if (existente) return existente;
    try {
      return (await this.prisma.sis2000Respaldo.create({
        data: {
          entidad: d.entidad,
          clave: d.clave,
          existia: d.existia,
          original: json(d.original),
          ...quien(d.usuario),
        },
      })) as RespaldoRow;
    } catch (err) {
      // Otra escritura simultánea creó la original primero: se usa esa (nunca se reemplaza).
      if (esDuplicado(err)) {
        const ganadora = await this.buscar(d.entidad, d.clave);
        if (ganadora) return ganadora;
      }
      throw err;
    }
  }

  async abrirVersion(
    respaldoId: string,
    d: {
      tipo: TipoVersion;
      anterior: unknown;
      payload: unknown;
      motivo?: string;
      restauradaDesde?: string;
      usuario?: UsuarioCambio;
    },
  ) {
    for (let intento = 0; ; intento++) {
      const ultima = await this.prisma.sis2000Version.aggregate({
        where: { respaldoId },
        _max: { numero: true },
      });
      try {
        return (await this.prisma.sis2000Version.create({
          data: {
            respaldoId,
            numero: (ultima._max.numero ?? 0) + 1,
            tipo: d.tipo,
            anterior: json(d.anterior),
            payload: json(d.payload),
            motivo: d.motivo ?? null,
            restauradaDesde: d.restauradaDesde ?? null,
            ...quien(d.usuario),
          },
        })) as VersionRow;
      } catch (err) {
        if (esDuplicado(err) && intento < 4) continue;
        throw err;
      }
    }
  }

  async cerrarVersion(
    id: string,
    d: { resultado: 'APLICADA' | 'FALLIDA'; estado?: unknown; cambios?: Cambio[]; error?: string },
  ) {
    return (await this.prisma.sis2000Version.update({
      where: { id },
      data: {
        resultado: d.resultado,
        estado: json(d.estado),
        cambios: json(d.cambios ?? []),
        error: d.error ?? null,
        terminadaEn: new Date(),
      },
    })) as VersionRow;
  }

  async versiones(respaldoId: string) {
    return (await this.prisma.sis2000Version.findMany({
      where: { respaldoId },
      orderBy: { numero: 'desc' },
    })) as VersionRow[];
  }

  async version(id: string) {
    return (await this.prisma.sis2000Version.findUnique({ where: { id } })) as VersionRow | null;
  }
}
