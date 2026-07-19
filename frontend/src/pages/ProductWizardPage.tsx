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
  normalizeInternalCode,
  prepareCoreFormForSubmit,
  validateCoreForm,
  type CoreFormInput,
} from '@/lib/product-form';
import { sanitizePlansForSave, syncPlansWithCoverages } from '@/lib/product-plans';

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
  const [violations, setViolations] = useState<GuardrailViolation[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CoreForm, string>>>({});

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
    technicalNoteUrl: '' as string | undefined,
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
    if (p.productPlans?.length) setProductPlans(p.productPlans);
    if (p.actuarialData) {
      setActuarial({
        purePremium: Number(p.actuarialData.purePremium),
        administrativeExpenses: Number(p.actuarialData.administrativeExpenses),
        commissions: Number(p.actuarialData.commissions),
        profitMargin: Number(p.actuarialData.profitMargin),
        actuaryName: p.actuarialData.actuaryName,
        actuaryCedula: p.actuarialData.actuaryCedula,
        actuarySudeasegNumber: p.actuarialData.actuarySudeasegNumber,
        technicalNoteUrl: p.actuarialData.technicalNoteUrl,
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
        const sanitized = coverages.map((c, i) => ({
          name: c.name,
          description: c.description,
          sortOrder: c.sortOrder ?? i,
          isBasicMandatory: c.isBasicMandatory,
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
        const plansToSave = sanitizePlansForSave(productPlans, coverages);
        await api.upsertProductPlans(
          pid,
          plansToSave.map((p, i) => ({
            name: p.name,
            description: p.description ?? undefined,
            badge: p.badge ?? undefined,
            priceFactor: p.priceFactor ?? 1,
            isRecommended: p.isRecommended ?? false,
            coverageIds: p.coverageIds ?? [],
            sortOrder: p.sortOrder ?? i,
          })),
        );
        setProductPlans(plansToSave);
      }
      if (step === 3) {
        await api.upsertActuarial(pid, {
          purePremium: Number(actuarial.purePremium),
          administrativeExpenses: Number(actuarial.administrativeExpenses),
          commissions: Number(actuarial.commissions),
          profitMargin: Number(actuarial.profitMargin),
          actuaryName: actuarial.actuaryName,
          actuaryCedula: actuarial.actuaryCedula,
          actuarySudeasegNumber: actuarial.actuarySudeasegNumber,
          technicalNoteUrl: actuarial.technicalNoteUrl || undefined,
          ratingVariables: actuarial.ratingVariables.map((v, i) => ({
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
    { icon: Scale, title: 'Revisión SUDEASEG', desc: 'Validación regulatoria y transición de estado' },
  ][step];

  const StepIcon = stepMeta.icon;

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
              Revisa las validaciones antes de enviar a SUDEASEG
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

            {error && <Alert variant="error">{error}</Alert>}

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
                      hint="Mínimo 3 caracteres. Visible para clientes y canales."
                      error={fieldErrors.commercialName}
                    >
                      <Input
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
                      hint={productId ? 'No editable tras crear el producto.' : 'Mayúsculas, números y guiones. Se genera automáticamente.'}
                      error={fieldErrors.internalCode}
                    >
                      <Input
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
                    <FormField label="Código de variante / sub-plan" hint="Diferencia planes dentro del mismo producto.">
                      <Input {...coreForm.register('subPlanCode')} placeholder="COND1" />
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
                    <FormField label="Período garantía de prima" hint="Días de gracia para el pago de prima.">
                      <Input type="number" {...coreForm.register('premiumGuaranteeDays', { valueAsNumber: true })} />
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
              <div className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  Define cada cobertura con sus sumas, primas y vigencias. Puedes agregar tantas como necesites.
                </p>
                {coverages.map((c, i) => {
                  const upd = (patch: Partial<Coverage>) => {
                    const next = [...coverages];
                    next[i] = { ...c, ...patch };
                    setCoverages(next);
                  };
                  return (
                    <div key={i} className="coverage-card">
                      <div className="coverage-card-header">
                        <div className="flex items-center gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                            {i + 1}
                          </span>
                          <div>
                            <p className="text-sm font-semibold">{c.name || 'Cobertura sin nombre'}</p>
                            <p className="text-xs text-muted-foreground">
                              {c.isBasicMandatory ? 'Básica obligatoria' : 'Cobertura accesoria'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs font-medium">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 accent-primary"
                              checked={!!c.isBasicMandatory}
                              onChange={(e) => upd({ isBasicMandatory: e.target.checked })}
                            />
                            Básica obligatoria
                          </label>
                          {coverages.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setCoverages(coverages.filter((_, idx) => idx !== i))}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Eliminar
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-5 p-5">
                        <FormGrid>
                          <FormField label="Nombre de la cobertura" span={2}>
                            <Input value={c.name} onChange={(e) => upd({ name: e.target.value })} />
                          </FormField>
                          <FormField label="Suma asegurada">
                            <Input
                              type="number"
                              placeholder="0"
                              value={c.insuredSumFixed ?? c.insuredSumMin ?? ''}
                              onChange={(e) =>
                                upd({
                                  insuredSumFixed:
                                    e.target.value === '' ? undefined : Number(e.target.value),
                                  insuredSumMin: undefined,
                                  insuredSumMax: undefined,
                                })
                              }
                            />
                          </FormField>
                          <FormField label="Prima de la cobertura">
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={c.tariffPremium ?? ''}
                              onChange={(e) => upd({ tariffPremium: Number(e.target.value) })}
                            />
                          </FormField>
                          <FormField label="Carencia (días)">
                            <Input
                              type="number"
                              value={c.waitingPeriodDays ?? 0}
                              onChange={(e) => upd({ waitingPeriodDays: Number(e.target.value) })}
                            />
                          </FormField>
                          <FormField label="Depende de otra cobertura" span={2} hint="La cobertura solo aplica si la seleccionada está activa.">
                            <Select
                              value={c.dependsOnCoverageName ?? '__none__'}
                              onValueChange={(v) =>
                                upd({ dependsOnCoverageName: v === '__none__' ? undefined : v })
                              }
                            >
                              <SelectTrigger><SelectValue placeholder="Ninguna" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Ninguna</SelectItem>
                                {coverages
                                  .filter((other, idx) => idx !== i && other.name)
                                  .map((other) => (
                                    <SelectItem key={other.name} value={other.name}>
                                      {other.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </FormField>
                        </FormGrid>

                        <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 p-4">
                          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Reaseguro (opcional)
                          </p>
                          <FormGrid>
                            <FormField label="Código de contrato">
                              <Input
                                value={c.reinsuranceContractCode ?? ''}
                                onChange={(e) => upd({ reinsuranceContractCode: e.target.value })}
                              />
                            </FormField>
                            <FormField label="Nombre del contrato">
                              <Input
                                value={c.reinsuranceContractName ?? ''}
                                onChange={(e) => upd({ reinsuranceContractName: e.target.value })}
                              />
                            </FormField>
                            <FormField label="Ramo de reaseguro" span={2}>
                              <Input
                                value={c.reinsuranceBranchCode ?? ''}
                                onChange={(e) => upd({ reinsuranceBranchCode: e.target.value })}
                              />
                            </FormField>
                          </FormGrid>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <Button
                  variant="outline"
                  className="w-full border-dashed sm:w-auto"
                  onClick={() =>
                    setCoverages([
                      ...coverages,
                      { name: 'Cobertura accesoria', isBasicMandatory: false, waitingPeriodDays: 0, insuredSumFixed: undefined },
                    ])
                  }
                >
                  <Plus className="h-4 w-4" />
                  Agregar cobertura
                </Button>
              </div>
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
                        value={actuarial.administrativeExpenses}
                        onChange={(e) =>
                          setActuarial({
                            ...actuarial,
                            administrativeExpenses: Number(e.target.value),
                          })
                        }
                      />
                    </FormField>
                    <FormField label="Comisiones (%)">
                      <Input
                        type="number"
                        value={actuarial.commissions}
                        onChange={(e) =>
                          setActuarial({ ...actuarial, commissions: Number(e.target.value) })
                        }
                      />
                    </FormField>
                    <FormField label="Utilidad (%)">
                      <Input
                        type="number"
                        value={actuarial.profitMargin}
                        onChange={(e) =>
                          setActuarial({ ...actuarial, profitMargin: Number(e.target.value) })
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
                    <FormField label="Nombre del actuario" span={2} hint="Mínimo 3 caracteres.">
                      <Input
                        value={actuarial.actuaryName}
                        onChange={(e) =>
                          setActuarial({ ...actuarial, actuaryName: e.target.value })
                        }
                      />
                    </FormField>
                    <FormField label="Cédula de identidad" hint="Mínimo 5 caracteres.">
                      <Input
                        value={actuarial.actuaryCedula}
                        onChange={(e) =>
                          setActuarial({ ...actuarial, actuaryCedula: e.target.value })
                        }
                      />
                    </FormField>
                    <FormField label="Registro SUDEASEG" hint="Solo mayúsculas, números y guiones (ej. ACT-1234).">
                      <Input
                        value={actuarial.actuarySudeasegNumber}
                        onChange={(e) =>
                          setActuarial({
                            ...actuarial,
                            actuarySudeasegNumber: e.target.value,
                          })
                        }
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
                          value={ex.text}
                          onChange={(e) => {
                            const next = [...exclusions];
                            next[i] = { ...ex, text: e.target.value };
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
              </SectionPanel>
              </div>
            )}

            {step === 5 && (
              <EmissionConfigStep
                flowSteps={emissionFlowSteps}
                formFields={emissionFormFields}
                branch={branch}
                plans={productPlans}
                requiredDocuments={requiredDocs}
                coverages={coverages}
                onFlowStepsChange={setEmissionFlowSteps}
                onFormFieldsChange={setEmissionFormFields}
              />
            )}

            {step === 6 && (
              <div className="space-y-6">
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
                    Sin violaciones detectadas. El producto está listo para avanzar en el flujo de aprobación.
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
                  <SectionPanel
                    title="Acciones de envío"
                    description="Transiciona el producto al siguiente estado del flujo regulatorio."
                    icon={Scale}
                  >
                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={async () => {
                          await api.transition(productId, 'ACTUARIAL_REVIEW');
                          await loadProduct(productId);
                        }}
                      >
                        Enviar a revisión actuarial
                      </Button>
                      <Button
                        size="lg"
                        onClick={async () => {
                          try {
                            await api.transition(productId, 'SUBMITTED_TO_SUDEASEG');
                            await loadProduct(productId);
                          } catch (e) {
                            setError(e instanceof Error ? e.message : 'Error');
                          }
                        }}
                      >
                        Enviar a SUDEASEG
                      </Button>
                    </div>
                  </SectionPanel>
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
