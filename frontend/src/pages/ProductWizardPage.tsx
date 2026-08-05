import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  calculateCommercialPremium,
  UNIFORM_BRANCHES,
} from '@ipb/shared';
import { ArrowLeft, ArrowRight, Calculator, Eye, FileCheck, FileText, Layers, LayoutGrid, Plus, Route, Save, Scale, Shield, Sparkles, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type {
  Coverage,
  Exclusion,
  FlowStepConfig,
  FormField as ProductFormField,
  GuardrailViolation,
  Product,
  ProductBranch,
  ProductPlan,
  RatingVariable,
  RequiredDocument,
} from '@/types/product';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { FormField, FormGrid } from '@/components/ui/form-field';
import { SectionPanel } from '@/components/ui/section-panel';
import { ToggleField } from '@/components/ui/toggle-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Stepper, STEPS } from '@/components/wizard/Stepper';
import { EmissionConfigStep } from '@/components/wizard/EmissionConfigStep';
import { PlansStep } from '@/components/wizard/PlansStep';
import { CoveragesStep } from '@/components/wizard/CoveragesStep';
import { ActivationSummary } from '@/components/wizard/ActivationSummary';
import { WizardStickyAlert } from '@/components/wizard/WizardStickyAlert';
import { ExclusionHtmlPreview } from '@/components/legal/ExclusionPreview';
import { AppShell } from '@/components/layout/AppShell';
import { Alert } from '@/components/ui/alert';
import {
  BRANCH_OPTIONS,
  DEFAULT_DOCUMENTS_BY_BRANCH,
  DOCUMENT_CATALOG,
} from '@/lib/constants';
import {
  generateDefaultInternalCode,
  normalizeActuarySudeasegNumber,
  normalizeInternalCode,
  prepareActuarialForSubmit,
  prepareCoreFormForSubmit,
  validateActuarialForm,
  validateCoreForm,
  type CoreFormInput,
} from '@/lib/product-form';
import { formatCedulaInput, normalizeCedula } from '@/lib/cedula';
import { sanitizePlansForSave, syncPlansWithCoverages, plansWithCalculatedPremiums, decodePlanFromApi, encodePlanDescription } from '@/lib/product-plans';
import { clampInt, clampPercent, clampText, FIELD_LIMITS } from '@/lib/field-limits';

type CoreForm = CoreFormInput;

function formatDate(value?: string | null) {
  return value?.slice(0, 10) ?? '';
}

function mapCoverageFromApi(c: Coverage): Coverage {
  return {
    ...c,
    insuredSumMin: c.insuredSumMin != null ? Number(c.insuredSumMin) : undefined,
    insuredSumMax: c.insuredSumMax != null ? Number(c.insuredSumMax) : undefined,
    insuredSumFixed: c.insuredSumFixed != null ? Number(c.insuredSumFixed) : undefined,
    deductibleValue: c.deductibleValue != null ? Number(c.deductibleValue) : undefined,
    tariffPremium: c.tariffPremium != null ? Number(c.tariffPremium) : undefined,
    vigenciaDesde: formatDate(c.vigenciaDesde),
    vigenciaHasta: formatDate(c.vigenciaHasta),
  };
}

const DEFAULT_EXCLUSION: Exclusion = {
  text: 'SE EXCLUYEN DAÑOS CAUSADOS POR ACTOS INTENCIONALES DEL ASEGURADO.',
  typographyHighlight: true,
};

function buildDefaultDocuments(branch: ProductBranch): RequiredDocument[] {
  const defaults = DEFAULT_DOCUMENTS_BY_BRANCH[branch] ?? {};
  return DOCUMENT_CATALOG.filter((d) => d.key in defaults).map((d, i) => ({
    documentKey: d.key,
    label: d.label,
    required: defaults[d.key],
    sortOrder: i,
  }));
}

function normalizeDocumentKey(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 60);
}

function isCatalogDocumentKey(key: string): boolean {
  return DOCUMENT_CATALOG.some((d) => d.key === key);
}

export function ProductWizardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const [step, setStep] = useState(0);
  const [productId, setProductId] = useState<string | null>(isNew ? null : id ?? null);
  const [product, setProduct] = useState<Product | null>(null);
  const [coverages, setCoverages] = useState<Coverage[]>([
    {
      name: 'Cobertura Básica',
      isBasicMandatory: true,
      insuredSumFixed: 10000,
      deductibleType: 'MONTO_FIJO',
      deductibleValue: 0,
      waitingPeriodDays: 0,
    },
  ]);
  const [exclusions, setExclusions] = useState<Exclusion[]>([DEFAULT_EXCLUSION]);
  const [requiredDocs, setRequiredDocs] = useState<RequiredDocument[]>(() =>
    buildDefaultDocuments('PATRIMONIAL'),
  );
  const [emissionFlowSteps, setEmissionFlowSteps] = useState<FlowStepConfig[]>([]);
  const [emissionFormFields, setEmissionFormFields] = useState<ProductFormField[]>([]);
  const [productPlans, setProductPlans] = useState<ProductPlan[]>([]);
  const [docsTouched, setDocsTouched] = useState(false);
  const [customDocLabel, setCustomDocLabel] = useState('');
  const [customDocKey, setCustomDocKey] = useState('');
  const [violations, setViolations] = useState<GuardrailViolation[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CoreForm, string>>>({});
  const [providenciaNumero, setProvidenciaNumero] = useState('');
  const [providenciaFecha, setProvidenciaFecha] = useState('');
  const [actuarialFieldErrors, setActuarialFieldErrors] = useState<
    Partial<Record<'actuaryName' | 'actuaryCedula' | 'actuarySudeasegNumber', string>>
  >({});

  const coreForm = useForm<CoreForm>({
    defaultValues: {
      commercialName: 'Nuevo producto',
      internalCode: generateDefaultInternalCode(),
      branch: 'PATRIMONIAL',
      currency: 'VES',
      emissionType: 'EMISION_GARANTIZADA',
      subPlanCode: '',
      vigenciaInicio: new Date().toISOString().slice(0, 10),
      vigenciaFin: '2040-12-31',
      allowsQuickEmission: false,
      renewalFrequency: 'ANUAL',
      renewalType: 'NORMAL',
      premiumGuaranteeDays: 30,
      annualClosingMonth: 12,
    },
  });

  const branch = coreForm.watch('branch');
  const isUniform = UNIFORM_BRANCHES.includes(branch);

  useEffect(() => {
    if (docsTouched) return;
    setRequiredDocs(buildDefaultDocuments(branch));
  }, [branch, docsTouched]);

  const [actuarial, setActuarial] = useState({
    purePremium: 100,
    administrativeExpenses: 10,
    commissions: 8,
    profitMargin: 5,
    actuaryName: '',
    actuaryCedula: '',
    actuarySudeasegNumber: '',
    technicalNoteUrl: '',
    ratingVariables: [
      { name: 'edad', label: 'Edad del asegurado', variableType: 'NUMBER' },
    ] as RatingVariable[],
  });

  const loadProduct = useCallback(async (pid: string) => {
    const p = await api.getProduct(pid);
    setProduct(p);
    coreForm.reset({
      commercialName: p.commercialName,
      internalCode: p.internalCode,
      branch: p.branch,
      currency: p.currency as CoreForm['currency'],
      emissionType: p.emissionType as CoreForm['emissionType'],
      subPlanCode: p.subPlanCode ?? '',
      vigenciaInicio: formatDate(p.vigenciaInicio) || new Date().toISOString().slice(0, 10),
      vigenciaFin: formatDate(p.vigenciaFin) || '2040-12-31',
      allowsQuickEmission: p.allowsQuickEmission ?? false,
      renewalFrequency: (p.renewalFrequency as CoreForm['renewalFrequency']) ?? 'ANUAL',
      renewalType: (p.renewalType as CoreForm['renewalType']) ?? 'NORMAL',
      premiumGuaranteeDays: p.premiumGuaranteeDays ?? 30,
      annualClosingMonth: p.annualClosingMonth ?? 12,
    });
    if (p.coverages?.length) setCoverages(p.coverages.map(mapCoverageFromApi));
    if (p.exclusions?.length) setExclusions(p.exclusions);
    if (p.requiredDocuments?.length) {
      setRequiredDocs(p.requiredDocuments);
      setDocsTouched(true);
    }
    if (p.flowStepConfigs?.length) setEmissionFlowSteps(p.flowStepConfigs);
    if (p.formFields?.length) setEmissionFormFields(p.formFields);
    if (p.productPlans?.length) {
      setProductPlans(p.productPlans.map(decodePlanFromApi));
    }
    if (p.actuarialData) {
      setActuarial({
        purePremium: Number(p.actuarialData.purePremium),
        administrativeExpenses: Number(p.actuarialData.administrativeExpenses),
        commissions: Number(p.actuarialData.commissions),
        profitMargin: Number(p.actuarialData.profitMargin),
        actuaryName: p.actuarialData.actuaryName,
        actuaryCedula: p.actuarialData.actuaryCedula,
        actuarySudeasegNumber: p.actuarialData.actuarySudeasegNumber,
        technicalNoteUrl: p.actuarialData.technicalNoteUrl ?? '',
        ratingVariables: p.actuarialData.ratingVariables ?? [],
      });
    }
  }, [coreForm]);

  const loadProductPlans = useCallback(async (pid: string) => {
    const [cfg, refreshed] = await Promise.all([
      api.getProductPlans(pid),
      api.getProduct(pid),
    ]);
    const freshCoverages = (refreshed.coverages ?? []).map(mapCoverageFromApi);
    setCoverages(freshCoverages);
    setProductPlans(syncPlansWithCoverages(cfg.plans, freshCoverages));
  }, []);

  const loadEmissionConfig = useCallback(async (pid: string) => {
    const cfg = await api.getEmissionConfig(pid);
    setEmissionFlowSteps(cfg.flowSteps);
    setEmissionFormFields(cfg.formFields);
  }, []);

  useEffect(() => {
    if (step === 2 && productId) {
      loadProductPlans(productId).catch(() => undefined);
    }
  }, [step, productId, loadProductPlans]);

  useEffect(() => {
    if (step === 5 && productId) {
      loadEmissionConfig(productId).catch(() => undefined);
    }
  }, [step, productId, loadEmissionConfig]);

  useEffect(() => {
    if (!isNew && id) loadProduct(id).catch((e) => setError(e.message));
  }, [id, isNew, loadProduct]);

  const commercialPremium = (() => {
    try {
      return calculateCommercialPremium(
        actuarial.purePremium,
        actuarial.administrativeExpenses,
        actuarial.commissions,
        actuarial.profitMargin,
      );
    } catch {
      return 0;
    }
  })();

  async function saveStep() {
    setSaving(true);
    setError(null);
    try {
      let pid = productId;
      if (step === 0) {
        const data = prepareCoreFormForSubmit(coreForm.getValues());
        coreForm.setValue('commercialName', data.commercialName);
        coreForm.setValue('internalCode', data.internalCode);

        const validation = validateCoreForm(data);
        if (!validation.valid) {
          setFieldErrors(validation.fieldErrors);
          setError(validation.message ?? 'Revisa los campos del producto.');
          return;
        }
        setFieldErrors({});

        if (!pid) {
          const created = await api.createProduct({
            ...data,
            vigenciaInicio: null,
            vigenciaFin: null,
          });
          pid = created.id;
          setProductId(pid);
          setProduct(created);
          navigate(`/products/${pid}`, { replace: true });
        } else {
          await api.updateProduct(pid, {
            commercialName: data.commercialName,
            currency: data.currency,
            emissionType: data.emissionType,
            subPlanCode: data.subPlanCode || null,
            vigenciaInicio: null,
            vigenciaFin: null,
            allowsQuickEmission: data.allowsQuickEmission,
            renewalFrequency: data.renewalFrequency,
            renewalType: data.renewalType,
            premiumGuaranteeDays: data.premiumGuaranteeDays,
            annualClosingMonth: data.annualClosingMonth,
          });
        }
      }
      if (!pid) throw new Error('Producto no creado');
      if (step === 1) {
        if (coverages.length === 0) {
          setError('Agrega al menos una cobertura en la tabla antes de continuar.');
          return;
        }
        const sanitized = coverages.map((c, i) => ({
          name: c.name,
          description: c.description,
          sortOrder: c.sortOrder ?? i,
          isBasicMandatory: c.isBasicMandatory,
          insuredSumMin: c.insuredSumMin != null ? Number(c.insuredSumMin) : undefined,
          insuredSumFixed:
            c.insuredSumFixed != null
              ? Number(c.insuredSumFixed)
              : c.insuredSumMin != null
                ? Number(c.insuredSumMin)
                : undefined,
          deductibleType: c.deductibleType,
          deductibleValue: c.deductibleValue != null ? Number(c.deductibleValue) : undefined,
          waitingPeriodDays: c.waitingPeriodDays ?? 0,
          tariffPremium: c.tariffPremium != null ? Number(c.tariffPremium) : undefined,
          dependsOnCoverageName: c.dependsOnCoverageName || undefined,
          reinsuranceContractCode: c.reinsuranceContractCode || undefined,
          reinsuranceContractName: c.reinsuranceContractName || undefined,
          reinsuranceBranchCode: c.reinsuranceBranchCode || undefined,
        }));
        await api.replaceCoverages(pid, sanitized);
        const refreshed = await api.getProduct(pid);
        if (refreshed.coverages?.length) {
          setCoverages(refreshed.coverages.map(mapCoverageFromApi));
        }
      }
      if (step === 2) {
        const plansToSave = plansWithCalculatedPremiums(
          sanitizePlansForSave(productPlans, coverages),
          coverages,
        );
        await api.upsertProductPlans(
          pid,
          plansToSave.map((p, i) => ({
            name: p.name,
            description: encodePlanDescription(p),
            badge: p.badge ?? undefined,
            priceFactor: p.priceFactor ?? 0,
            isRecommended: p.isRecommended ?? false,
            coverageIds: p.coverageIds ?? [],
            sortOrder: p.sortOrder ?? i,
          })),
        );
        setProductPlans(plansToSave);
      }
      if (step === 3) {
        const actuarialPayload = prepareActuarialForSubmit(actuarial);
        const validation = validateActuarialForm(actuarialPayload);
        if (!validation.valid) {
          setActuarialFieldErrors(validation.fieldErrors);
          setError(validation.message ?? 'Revisa los datos actuariales.');
          return;
        }
        setActuarialFieldErrors({});
        await api.upsertActuarial(pid, {
          purePremium: Number(actuarialPayload.purePremium),
          administrativeExpenses: Number(actuarialPayload.administrativeExpenses),
          commissions: Number(actuarialPayload.commissions),
          profitMargin: Number(actuarialPayload.profitMargin),
          actuaryName: actuarialPayload.actuaryName,
          actuaryCedula: actuarialPayload.actuaryCedula,
          actuarySudeasegNumber: actuarialPayload.actuarySudeasegNumber,
          technicalNoteUrl: actuarialPayload.technicalNoteUrl || undefined,
          ratingVariables: (actuarialPayload.ratingVariables ?? []).map((v, i) => ({
            name: v.name,
            label: v.label,
            variableType: v.variableType,
            required: v.required ?? true,
            sortOrder: v.sortOrder ?? i,
            options: v.options,
          })),
        });
      }
      if (step === 4)
        await api.upsertLegal(pid, {
          exclusions: exclusions.map((ex, i) => ({
            text: ex.text,
            sortOrder: ex.sortOrder ?? i,
            typographyHighlight: ex.typographyHighlight ?? true,
          })),
          documents: [
            {
              documentType: 'CONDICIONES_GENERALES',
              title: 'Condiciones Generales',
              content: isUniform
                ? 'Texto uniforme bloqueado — personalización solo vía Anexos.'
                : 'Condiciones generales del producto.',
              isLocked: branch === 'RCV_OBLIGATORIO',
              isSimplifiedTemplate: isUniform,
            },
            {
              documentType: 'CONDICIONES_PARTICULARES',
              title: 'Condiciones Particulares',
              content: 'Cláusulas particulares configurables.',
            },
          ],
          commercialChannels:
            branch === 'INCLUSIVO'
              ? [{ name: 'Red Comunitaria', channelType: 'ALTERNATIVO' }]
              : [],
          requiredDocuments: requiredDocs.map((d, i) => ({
            documentKey: d.documentKey,
            label: d.label,
            required: d.required ?? true,
            sortOrder: i,
          })),
        });
      if (step === 5) {
        await api.upsertEmissionConfig(pid, {
          flowSteps: emissionFlowSteps.map((s, i) => ({
            stepKey: s.stepKey,
            label: s.label,
            shortLabel: s.shortLabel ?? undefined,
            description: s.description ?? undefined,
            enabled: s.enabled ?? true,
            formEnabled: s.formEnabled ?? true,
            sortOrder: s.sortOrder ?? i,
          })),
          formFields: emissionFormFields.map((f, i) => ({
            label: f.label,
            fieldType: f.fieldType,
            required: f.required ?? true,
            options: f.options,
            stepKey: f.stepKey ?? 'RISK_DATA',
            sortOrder: f.sortOrder ?? i,
          })),
        });
      }
      if (step === 6 && pid) {
        const v = await api.validateSubmission(pid);
        setViolations(v.violations);
      }
      if (pid) await loadProduct(pid);
      setStep((s) => Math.min(s + 1, 6));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const stepMeta = [
    { icon: Shield, title: 'Datos del producto', desc: 'Identificación, plan y vigencia del contrato' },
    { icon: Layers, title: 'Coberturas y tarifas', desc: 'Sumas aseguradas, primas y vigencias por cobertura' },
    { icon: LayoutGrid, title: 'Planes comerciales', desc: 'Opciones de venta y coberturas incluidas por plan' },
    { icon: Calculator, title: 'Actuarial y tarificación', desc: 'Prima pura, recargos y registro del actuario' },
    { icon: FileText, title: 'Documental legal', desc: 'Exclusiones Art. 68 y documentos requeridos' },
    { icon: Route, title: 'Flujo de emisión', desc: 'Pasos del flujo y formularios por etapa' },
    { icon: Scale, title: 'Activación del producto', desc: 'Verificación final y publicación en catálogo' },
  ][step];

  const actuarialStickyMessage =
    step === 3
      ? [
          error,
          ...Object.entries(actuarialFieldErrors).map(
            ([key, msg]) =>
              `${key === 'actuaryName' ? 'Nombre del actuario' : key === 'actuaryCedula' ? 'Cédula del actuario' : key === 'actuarySudeasegNumber' ? 'Registro SUDEASEG' : key}: ${msg}`,
          ),
        ]
          .filter(Boolean)
          .join('. ')
      : '';

  const showTopError = error && step !== 3;

  const StepIcon = stepMeta.icon;
  const emissionActiveCount = emissionFlowSteps.filter((s) => s.enabled !== false).length;

  return (
    <AppShell
      maxWidth="7xl"
      backTo={{ href: '/', label: 'Productos' }}
      actions={
        productId ? (
          <Button asChild variant="outline" size="sm">
            <Link to={`/products/${productId}/preview`}>
              <Eye className="h-4 w-4" />
              Vista previa del flujo
            </Link>
          </Button>
        ) : undefined
      }
      headerExtra={
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {isNew ? 'Nuevo producto' : product?.commercialName ?? 'Editar producto'}
          </p>
          <p className="text-xs text-muted-foreground">
            Paso {step + 1} de {STEPS.length} · {STEPS[step].label}
          </p>
        </div>
      }
      footer={
        <div className="wizard-footer">
          <Button
            variant="outline"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
          >
            <ArrowLeft className="h-4 w-4" />
            Anterior
          </Button>
          {step < 6 ? (
            <Button onClick={saveStep} disabled={saving} size="lg">
              <Save className="h-4 w-4" />
              {saving ? 'Guardando...' : 'Guardar y continuar'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Revisa las validaciones antes de activar el producto
            </p>
          )}
        </div>
      }
    >
      <div className="animate-slide-up">
        <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="surface-card overflow-hidden p-1 pb-4 step-enter">
              <p className="mb-3 px-3 pt-3 text-[0.68rem] font-black uppercase tracking-[0.18em] text-slate-500">
                Progreso
              </p>
              <Stepper
                current={step}
                variant="vertical"
                onStepClick={(s) => productId && setStep(s)}
              />
            </div>
          </aside>

          <div className="min-w-0 space-y-6">
            <div className="lg:hidden">
              <Stepper current={step} />
            </div>

            {showTopError && <Alert variant="error">{error}</Alert>}

            {step === 3 && actuarialStickyMessage && (
              <WizardStickyAlert
                message={actuarialStickyMessage}
                onDismiss={() => {
                  setError('');
                  setActuarialFieldErrors({});
                }}
              />
            )}

            <Card className="surface-card step-enter overflow-hidden border-0 shadow-none">
              <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white">
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 p-3.5 shadow-sm">
                    <StepIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] gradient-text-indigo">
                      Paso {step + 1} de {STEPS.length}
                    </p>
                    <CardTitle className="font-display mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                      {stepMeta.title}
                    </CardTitle>
                    <CardDescription className="mt-1.5 text-sm text-slate-500">
                      {stepMeta.desc}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 sm:p-8">
            {step === 0 && (
              <div className="space-y-6">
                <SectionPanel
                  title="Identificación del producto"
                  description="Datos comerciales y clasificación regulatoria SUDEASEG."
                  icon={Shield}
                >
                  <FormGrid>
                    <FormField
                      label="Nombre comercial"
                      span={2}
                      hint="Mínimo 3 caracteres, máximo 200. Visible para clientes y canales."
                      error={fieldErrors.commercialName}
                    >
                      <Input
                        maxLength={FIELD_LIMITS.product.commercialName}
                        {...coreForm.register('commercialName', {
                          onChange: () => {
                            if (fieldErrors.commercialName) {
                              setFieldErrors((e) => ({ ...e, commercialName: undefined }));
                            }
                          },
                        })}
                        placeholder="Ej. Combinado Residencial I"
                      />
                    </FormField>
                    <FormField
                      label="Código interno"
                      hint={productId ? 'No editable tras crear el producto.' : 'Mayúsculas, números y guiones. Máximo 50 caracteres.'}
                      error={fieldErrors.internalCode}
                    >
                      <Input
                        maxLength={FIELD_LIMITS.product.internalCode}
                        value={coreForm.watch('internalCode')}
                        onChange={(e) => {
                          const normalized = normalizeInternalCode(e.target.value);
                          coreForm.setValue('internalCode', normalized, { shouldDirty: true });
                          if (fieldErrors.internalCode) {
                            setFieldErrors((err) => ({ ...err, internalCode: undefined }));
                          }
                        }}
                        placeholder="PROD-001"
                        disabled={!!productId}
                        className="font-mono uppercase"
                      />
                    </FormField>
                    <FormField label="Código de variante / sub-plan" hint="Máximo 50 caracteres. Diferencia planes dentro del mismo producto.">
                      <Input
                        maxLength={FIELD_LIMITS.product.subPlanCode}
                        {...coreForm.register('subPlanCode')}
                        placeholder="COND1"
                      />
                    </FormField>
                    <FormField label="Ramo SUDEASEG">
                      <Select
                        value={branch}
                        disabled={!!productId}
                        onValueChange={(v) => coreForm.setValue('branch', v as ProductBranch)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BRANCH_OPTIONS.map((b) => (
                            <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                    <FormField label="Moneda">
                      <Select
                        value={coreForm.watch('currency')}
                        onValueChange={(v) => coreForm.setValue('currency', v as CoreForm['currency'])}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="VES">VES — Bolívar</SelectItem>
                          <SelectItem value="USD">USD — Dólar</SelectItem>
                          <SelectItem value="INDEXADO">INDEXADO</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormField>
                    <FormField label="Tipo de emisión" span={2}>
                      <Select
                        value={coreForm.watch('emissionType')}
                        onValueChange={(v) => coreForm.setValue('emissionType', v as CoreForm['emissionType'])}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EMISION_GARANTIZADA">Emisión garantizada</SelectItem>
                          <SelectItem value="REQUIERE_DECLARACION_SALUD">Requiere declaración de salud</SelectItem>
                          <SelectItem value="REQUIERE_INSPECCION">Requiere inspección</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormField>
                  </FormGrid>
                  {isUniform && (
                    <Alert variant="warning" className="mt-4">
                      Contrato simplificado/uniforme (RCV o Inclusivo). Las Condiciones Generales quedan bloqueadas.
                    </Alert>
                  )}
                </SectionPanel>

                <SectionPanel
                  title="Condiciones del plan"
                  description="Parámetros operativos del contrato y renovación."
                  icon={FileText}
                >
                  <FormGrid>
                    <FormField label="Frecuencia de renovación">
                      <Select
                        value={coreForm.watch('renewalFrequency')}
                        onValueChange={(v) => coreForm.setValue('renewalFrequency', v as CoreForm['renewalFrequency'])}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ANUAL">Anual</SelectItem>
                          <SelectItem value="SEMESTRAL">Semestral</SelectItem>
                          <SelectItem value="TRIMESTRAL">Trimestral</SelectItem>
                          <SelectItem value="MENSUAL">Mensual</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormField>
                    <FormField label="Tipo de renovación">
                      <Select
                        value={coreForm.watch('renewalType')}
                        onValueChange={(v) => coreForm.setValue('renewalType', v as CoreForm['renewalType'])}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NORMAL">Normal</SelectItem>
                          <SelectItem value="TACITA">Tácita</SelectItem>
                          <SelectItem value="CON_AVISO">Con aviso previo</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormField>
                    <FormField label="Período garantía de prima" hint="Días de gracia (0–365).">
                      <Input
                        type="number"
                        min={0}
                        max={FIELD_LIMITS.product.premiumGuaranteeDays}
                        {...coreForm.register('premiumGuaranteeDays', { valueAsNumber: true })}
                      />
                    </FormField>
                    <FormField label="Mes de cierre anual">
                      <Select
                        value={String(coreForm.watch('annualClosingMonth'))}
                        onValueChange={(v) => coreForm.setValue('annualClosingMonth', Number(v))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <SelectItem key={m} value={String(m)}>Mes {m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                    <FormField span={2}>
                      <ToggleField
                        id="quickEmission"
                        label="Permite emisión rápida"
                        description="Habilita flujo simplificado de emisión sin pasos adicionales."
                        checked={coreForm.watch('allowsQuickEmission')}
                        onChange={(v) => coreForm.setValue('allowsQuickEmission', v)}
                      />
                    </FormField>
                  </FormGrid>
                </SectionPanel>
              </div>
            )}

            {step === 1 && (
              <CoveragesStep coverages={coverages} onCoveragesChange={setCoverages} />
            )}

            {step === 2 && (
              <PlansStep
                plans={productPlans}
                coverages={coverages}
                onPlansChange={setProductPlans}
              />
            )}

            {step === 3 && (
              <div className="space-y-6">
                <SectionPanel
                  title="Componentes de la prima"
                  description="Ingresa los porcentajes de recargo sobre la prima pura."
                  icon={Calculator}
                >
                  <FormGrid>
                    <FormField label="Prima pura">
                      <Input
                        type="number"
                        value={actuarial.purePremium}
                        onChange={(e) =>
                          setActuarial({ ...actuarial, purePremium: Number(e.target.value) })
                        }
                      />
                    </FormField>
                    <FormField label="Gastos administrativos (%)" hint="Porcentaje sobre prima pura.">
                      <Input
                        type="number"
                        min={0}
                        max={FIELD_LIMITS.actuarial.percentMax}
                        step={0.01}
                        value={actuarial.administrativeExpenses}
                        onChange={(e) =>
                          setActuarial({
                            ...actuarial,
                            administrativeExpenses: clampPercent(Number(e.target.value)),
                          })
                        }
                      />
                    </FormField>
                    <FormField label="Comisiones (%)">
                      <Input
                        type="number"
                        min={0}
                        max={FIELD_LIMITS.actuarial.percentMax}
                        step={0.01}
                        value={actuarial.commissions}
                        onChange={(e) =>
                          setActuarial({
                            ...actuarial,
                            commissions: clampPercent(Number(e.target.value)),
                          })
                        }
                      />
                    </FormField>
                    <FormField label="Utilidad (%)">
                      <Input
                        type="number"
                        min={0}
                        max={FIELD_LIMITS.actuarial.percentMax}
                        step={0.01}
                        value={actuarial.profitMargin}
                        onChange={(e) =>
                          setActuarial({
                            ...actuarial,
                            profitMargin: clampPercent(Number(e.target.value)),
                          })
                        }
                      />
                    </FormField>
                  </FormGrid>

                  <div className="premium-highlight mt-5">
                    <p className="text-sm font-medium text-muted-foreground">Prima comercial calculada</p>
                    <p className="tabular-nums mt-2 text-4xl font-bold tracking-tight text-primary">
                      {commercialPremium.toFixed(2)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Fórmula: Prima pura ÷ (1 − Gastos − Comisiones − Utilidad)
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        ['Pura', actuarial.purePremium],
                        ['Gastos', `${actuarial.administrativeExpenses}%`],
                        ['Comisiones', `${actuarial.commissions}%`],
                        ['Utilidad', `${actuarial.profitMargin}%`],
                      ].map(([k, v]) => (
                        <div key={k} className="rounded-lg bg-card/80 px-3 py-2 text-center ring-1 ring-border/50">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
                          <p className="text-sm font-semibold">{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </SectionPanel>

                <SectionPanel
                  title="Responsable actuarial"
                  description="Datos del actuario responsable de la nota técnica."
                  icon={Shield}
                >
                  <FormGrid>
                    <FormField label="Nombre del actuario" span={2} hint="Mínimo 3, máximo 150 caracteres." error={actuarialFieldErrors.actuaryName}>
                      <Input
                        maxLength={FIELD_LIMITS.actuarial.actuaryName}
                        value={actuarial.actuaryName}
                        onChange={(e) => {
                          setActuarial({ ...actuarial, actuaryName: e.target.value });
                          if (actuarialFieldErrors.actuaryName) {
                            setActuarialFieldErrors((prev) => ({ ...prev, actuaryName: undefined }));
                          }
                        }}
                      />
                    </FormField>
                    <FormField label="Cédula de identidad" hint="Formato V-12345678 (V, E, J, G o P)." error={actuarialFieldErrors.actuaryCedula}>
                      <Input
                        maxLength={FIELD_LIMITS.actuarial.actuaryCedula}
                        value={actuarial.actuaryCedula}
                        placeholder="V-12345678"
                        onChange={(e) => {
                          setActuarial({
                            ...actuarial,
                            actuaryCedula: formatCedulaInput(e.target.value),
                          });
                          if (actuarialFieldErrors.actuaryCedula) {
                            setActuarialFieldErrors((prev) => ({ ...prev, actuaryCedula: undefined }));
                          }
                        }}
                        onBlur={() =>
                          setActuarial((prev) => ({
                            ...prev,
                            actuaryCedula: normalizeCedula(prev.actuaryCedula),
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="Registro SUDEASEG" hint="Mayúsculas, números y guiones. Máximo 50 (ej. ACT-2024-001)." error={actuarialFieldErrors.actuarySudeasegNumber}>
                      <Input
                        maxLength={FIELD_LIMITS.actuarial.actuarySudeasegNumber}
                        value={actuarial.actuarySudeasegNumber}
                        onChange={(e) => {
                          setActuarial({
                            ...actuarial,
                            actuarySudeasegNumber: normalizeActuarySudeasegNumber(e.target.value),
                          });
                          if (actuarialFieldErrors.actuarySudeasegNumber) {
                            setActuarialFieldErrors((prev) => ({
                              ...prev,
                              actuarySudeasegNumber: undefined,
                            }));
                          }
                        }}
                      />
                    </FormField>
                  </FormGrid>
                </SectionPanel>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Redacta las exclusiones conforme al Art. 68. El resaltado tipográfico es obligatorio.
                  </p>
                  {exclusions.map((ex, i) => (
                    <div
                      key={i}
                      className="space-y-3 rounded-2xl border border-border/60 bg-card p-5 shadow-sm"
                    >
                      <FormField label={`Exclusión ${i + 1}`}>
                        <Textarea
                          maxLength={FIELD_LIMITS.legal.exclusionText}
                          value={ex.text}
                          onChange={(e) => {
                            const next = [...exclusions];
                            next[i] = {
                              ...ex,
                              text: clampText(e.target.value, FIELD_LIMITS.legal.exclusionText),
                            };
                            setExclusions(next);
                          }}
                        />
                      </FormField>
                      <ToggleField
                        id={`highlight-${i}`}
                        label="Resalte tipográfico obligatorio"
                        description="Cumplimiento Art. 68 — la exclusión debe destacarse visualmente en la póliza."
                        checked={!!ex.typographyHighlight}
                        onChange={(v) => {
                          const next = [...exclusions];
                          next[i] = { ...ex, typographyHighlight: v };
                          setExclusions(next);
                        }}
                      />
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    className="border-dashed"
                    onClick={() =>
                      setExclusions([
                        ...exclusions,
                        { text: '', typographyHighlight: true },
                      ])
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Agregar exclusión
                  </Button>
                </div>
                <div className="xl:sticky xl:top-24 xl:self-start">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Vista previa
                  </p>
                  <ExclusionHtmlPreview exclusions={exclusions} />
                </div>
              </div>

              <SectionPanel
                icon={FileCheck}
                title="Documentos requeridos al asegurado"
                description="Selecciona qué recaudos deberá presentar el cliente para emitir la póliza. Marca cada uno como obligatorio u opcional."
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {requiredDocs.length > 0
                      ? `${requiredDocs.length} documento(s) seleccionado(s) · ${requiredDocs.filter((d) => d.required).length} obligatorio(s)`
                      : 'Ningún documento seleccionado todavía.'}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => {
                      setRequiredDocs(buildDefaultDocuments(branch));
                      setDocsTouched(true);
                    }}
                  >
                    <Sparkles className="h-4 w-4" />
                    Sugerir según ramo
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {DOCUMENT_CATALOG.map((item) => {
                    const selected = requiredDocs.find((d) => d.documentKey === item.key);
                    const isSelected = !!selected;
                    return (
                      <div
                        key={item.key}
                        className={cn(
                          'rounded-xl border p-4 transition-colors',
                          isSelected
                            ? 'border-primary/30 bg-primary/5'
                            : 'border-border/60 bg-muted/15',
                        )}
                      >
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
                            checked={isSelected}
                            onChange={(e) => {
                              setDocsTouched(true);
                              setRequiredDocs((prev) => {
                                if (e.target.checked) {
                                  return [
                                    ...prev,
                                    {
                                      documentKey: item.key,
                                      label: item.label,
                                      required: true,
                                      sortOrder: prev.length,
                                    },
                                  ];
                                }
                                return prev.filter((d) => d.documentKey !== item.key);
                              });
                            }}
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-foreground">
                              {item.label}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {item.hint}
                            </span>
                          </span>
                        </label>
                        {isSelected && (
                          <div className="mt-3 inline-flex rounded-lg border border-border/60 bg-card p-0.5 text-xs font-medium">
                            <button
                              type="button"
                              onClick={() => {
                                setDocsTouched(true);
                                setRequiredDocs((prev) =>
                                  prev.map((d) =>
                                    d.documentKey === item.key
                                      ? { ...d, required: true }
                                      : d,
                                  ),
                                );
                              }}
                              className={cn(
                                'rounded-md px-3 py-1 transition-colors',
                                selected?.required
                                  ? 'bg-primary text-primary-foreground'
                                  : 'text-muted-foreground hover:text-foreground',
                              )}
                            >
                              Obligatorio
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDocsTouched(true);
                                setRequiredDocs((prev) =>
                                  prev.map((d) =>
                                    d.documentKey === item.key
                                      ? { ...d, required: false }
                                      : d,
                                  ),
                                );
                              }}
                              className={cn(
                                'rounded-md px-3 py-1 transition-colors',
                                !selected?.required
                                  ? 'bg-amber-500 text-white'
                                  : 'text-muted-foreground hover:text-foreground',
                              )}
                            >
                              Opcional
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 rounded-xl border border-dashed border-border/70 bg-muted/10 p-4">
                  <h3 className="text-sm font-semibold">Agregar documento personalizado</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Si necesitas un recaudo que no está en el catálogo, créalo aquí con un
                    identificador único.
                  </p>
                  <FormGrid className="mt-4">
                    <FormField label="Identificador (clave)" hint="Mayúsculas, números y guiones. Ej. CARTA_SOLVENCIA">
                      <Input
                        maxLength={60}
                        value={customDocKey}
                        placeholder="CARTA_SOLVENCIA"
                        className="font-mono uppercase"
                        onChange={(e) =>
                          setCustomDocKey(normalizeDocumentKey(e.target.value))
                        }
                      />
                    </FormField>
                    <FormField label="Nombre visible" hint="Texto que verá el cliente.">
                      <Input
                        maxLength={120}
                        value={customDocLabel}
                        placeholder="Carta de solvencia"
                        onChange={(e) => setCustomDocLabel(e.target.value)}
                      />
                    </FormField>
                  </FormGrid>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    disabled={
                      customDocLabel.trim().length < 2 ||
                      normalizeDocumentKey(customDocKey).length < 2 ||
                      requiredDocs.some(
                        (d) => d.documentKey === normalizeDocumentKey(customDocKey),
                      )
                    }
                    onClick={() => {
                      const key = normalizeDocumentKey(customDocKey);
                      const label = customDocLabel.trim();
                      if (key.length < 2 || label.length < 2) return;
                      setDocsTouched(true);
                      setRequiredDocs((prev) => [
                        ...prev,
                        {
                          documentKey: key,
                          label,
                          required: true,
                          sortOrder: prev.length,
                        },
                      ]);
                      setCustomDocKey('');
                      setCustomDocLabel('');
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Agregar documento
                  </Button>

                  {requiredDocs.some((d) => !isCatalogDocumentKey(d.documentKey)) && (
                    <ul className="mt-4 space-y-2">
                      {requiredDocs
                        .filter((d) => !isCatalogDocumentKey(d.documentKey))
                        .map((d) => (
                          <li
                            key={d.documentKey}
                            className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-sm"
                          >
                            <span>
                              <strong>{d.label}</strong>
                              <span className="ml-2 font-mono text-xs text-muted-foreground">
                                {d.documentKey}
                              </span>
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => {
                                setDocsTouched(true);
                                setRequiredDocs((prev) =>
                                  prev.filter((x) => x.documentKey !== d.documentKey),
                                );
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              </SectionPanel>
              </div>
            )}

            {step === 5 && (
              <EmissionConfigStep
                flowSteps={emissionFlowSteps}
                formFields={emissionFormFields}
                branch={branch}
                plans={productPlans.filter((p) => p.isActive !== false)}
                requiredDocuments={requiredDocs}
                coverages={coverages}
                ratingVariables={actuarial.ratingVariables}
                onFlowStepsChange={setEmissionFlowSteps}
                onFormFieldsChange={setEmissionFormFields}
              />
            )}

            {step === 6 && (
              <div className="space-y-6">
                <ActivationSummary
                  product={product}
                  commercialName={coreForm.watch('commercialName')}
                  branch={branch}
                  internalCode={coreForm.watch('internalCode')}
                  coverages={coverages}
                  plans={productPlans}
                  requiredDocuments={requiredDocs}
                  emissionStepCount={emissionActiveCount}
                  commercialPremium={commercialPremium}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Estado del producto
                    </p>
                    <p className="mt-2 text-2xl font-bold text-primary">
                      {product?.status ?? 'DRAFT'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Validaciones
                    </p>
                    <p className="mt-2 text-2xl font-bold">
                      {violations.length === 0 ? (
                        <span className="text-emerald-600">Sin bloqueos</span>
                      ) : (
                        <span className="text-destructive">{violations.length} pendientes</span>
                      )}
                    </p>
                  </div>
                </div>

                {violations.length === 0 ? (
                  <Alert variant="success">
                    Sin violaciones detectadas. El producto está listo para activarse en el
                    catálogo comercial.
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    {violations.map((v) => (
                      <Alert key={v.code} variant="error">
                        <strong>{v.code}</strong>: {v.message}
                      </Alert>
                    ))}
                  </div>
                )}

                {productId && (
                  <>
                    {coverages.length > 0 && productPlans.some((p) => p.isActive !== false) &&
                      product?.status !== 'REJECTED' && (
                      <Alert variant="success">
                        Este producto ya está disponible para emisión en el flujo Exélixi
                        (tiene coberturas y al menos un plan activo). El ciclo SUDEASEG de
                        abajo es el trámite regulatorio y no bloquea la emisión.
                      </Alert>
                    )}
                    <SectionPanel
                      title="Activación y ciclo regulatorio"
                      description="«Activar producto» avanza automáticamente todas las etapas válidas: Borrador → Revisión actuarial → SUDEASEG (y Aprobado si cargas la providencia)."
                      icon={Scale}
                    >
                      <div className="space-y-4">
                        {product?.status !== 'APPROVED_ACTIVE' && (
                          <FormGrid>
                            <FormField label="N° providencia SUDEASEG (opcional)">
                              <Input
                                value={providenciaNumero}
                                onChange={(e) => setProvidenciaNumero(e.target.value)}
                                placeholder="FSAA-1-1-0000-2026"
                              />
                            </FormField>
                            <FormField label="Fecha Gaceta de aprobación (opcional)">
                              <Input
                                type="date"
                                value={providenciaFecha}
                                onChange={(e) => setProvidenciaFecha(e.target.value)}
                              />
                            </FormField>
                          </FormGrid>
                        )}
                        <div className="flex flex-wrap items-center gap-3">
                          {product?.status !== 'APPROVED_ACTIVE' && (
                            <Button
                              size="lg"
                              onClick={async () => {
                                try {
                                  setError(null);
                                  let status = product?.status ?? 'DRAFT';
                                  if (status === 'REJECTED') {
                                    await api.transition(productId, 'DRAFT');
                                    status = 'DRAFT';
                                  }
                                  if (status === 'DRAFT') {
                                    await api.transition(productId, 'ACTUARIAL_REVIEW');
                                    status = 'ACTUARIAL_REVIEW';
                                  }
                                  if (status === 'ACTUARIAL_REVIEW') {
                                    await api.transition(productId, 'SUBMITTED_TO_SUDEASEG');
                                    status = 'SUBMITTED_TO_SUDEASEG';
                                  }
                                  if (
                                    status === 'SUBMITTED_TO_SUDEASEG' &&
                                    providenciaNumero.trim() &&
                                    providenciaFecha
                                  ) {
                                    await api.approve(
                                      productId,
                                      providenciaNumero.trim(),
                                      providenciaFecha,
                                    );
                                  }
                                } catch (e) {
                                  setError(e instanceof Error ? e.message : 'Error');
                                } finally {
                                  await loadProduct(productId);
                                }
                              }}
                            >
                              Activar producto
                            </Button>
                          )}
                          {product?.status === 'ACTUARIAL_REVIEW' && (
                            <Button
                              variant="outline"
                              size="lg"
                              onClick={async () => {
                                try {
                                  await api.transition(productId, 'DRAFT');
                                  await loadProduct(productId);
                                } catch (e) {
                                  setError(e instanceof Error ? e.message : 'Error');
                                }
                              }}
                            >
                              Devolver a borrador
                            </Button>
                          )}
                          {product?.status === 'APPROVED_ACTIVE' && (
                            <Alert variant="success">
                              Producto aprobado y activo — es inmutable; para cambios crea una
                              nueva versión.
                            </Alert>
                          )}
                        </div>
                        {product?.status === 'SUBMITTED_TO_SUDEASEG' && (
                          <p className="text-sm text-muted-foreground">
                            El producto quedó en «Enviado a SUDEASEG». Para pasarlo a Aprobado,
                            carga el N° de providencia y la fecha de Gaceta y vuelve a pulsar
                            «Activar producto». Mientras tanto ya puede emitirse.
                          </p>
                        )}
                      </div>
                    </SectionPanel>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
