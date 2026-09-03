import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  CreditCard,
  FileUp,
  PenLine,
  Upload,
} from 'lucide-react';
import { api } from '@/lib/api';
import { buildFlowPreviewContext } from '@/lib/emission-flow';
import { currencySymbol } from '@/lib/core-catalog';
import { labelAssignedChannel } from '@/lib/plan-channels';
import {
  activeProductPlans,
  enrichPlansWithCoverages,
  resolvePlanDisplayPrice,
} from '@/lib/product-plans';
import type { FormField as ProductFormField } from '@/types/product';
import type { Product } from '@/types/product';
import { AppShell } from '@/components/layout/AppShell';
import { FlowStepper } from '@/components/flow/FlowStepper';
import { LiveSummary } from '@/components/flow/LiveSummary';
import { GuideBanner } from '@/components/flow/GuideBanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { BRANCH_META } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function EmissionFlowPreviewPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState(0);

  const load = useCallback(async (pid: string) => {
    setLoading(true);
    setError(null);
    try {
      const p = await api.getProduct(pid);
      setProduct(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar producto');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id) load(id);
  }, [id, load]);

  const ctx = useMemo(
    () => (product ? buildFlowPreviewContext(product) : null),
    [product],
  );

  const currentStep = ctx?.steps[stepIndex];
  const stepId = currentStep?.id;

  const plans = useMemo(() => {
    if (!product) return [];
    const configured = activeProductPlans(product.productPlans ?? []);
    if (configured.length === 0) return [];
    const enriched = enrichPlansWithCoverages(configured, product);
    return enriched.map((p) => ({
      name: p.name,
      badge: p.badge ?? 'Plan',
      price: resolvePlanDisplayPrice(p, product),
      isRecommended: p.isRecommended,
      coverages: p.coverageLabels ?? [],
      assignedChannel: p.assignedChannel,
    }));
  }, [product]);

  useEffect(() => {
    setSelectedPlan(0);
  }, [plans.length, product?.id]);

  function goNext() {
    if (!ctx) return;
    setStepIndex((i) => Math.min(i + 1, ctx.steps.length - 1));
  }

  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  if (loading) {
    return (
      <AppShell backTo={{ href: '/', label: 'Productos' }} title="Vista previa del flujo">
        <div className="h-64 animate-pulse rounded-2xl bg-muted/60" />
      </AppShell>
    );
  }

  if (error || !product || !ctx) {
    return (
      <AppShell backTo={{ href: '/', label: 'Productos' }} title="Vista previa del flujo">
        <Alert variant="error">{error ?? 'Producto no encontrado'}</Alert>
      </AppShell>
    );
  }

  const branchMeta = BRANCH_META[product.branch];

  return (
    <AppShell
      variant="flow"
      maxWidth="full"
      backTo={{ href: `/products/${product.id}`, label: 'Configuración' }}
      title="Flujo guiado de compra"
      subtitle={`Vista previa · ${product.commercialName}`}
      actions={
        <Badge className="border-border font-mono text-xs">
          {product.internalCode}
        </Badge>
      }
      footer={
        <div className="flex items-center justify-between gap-4">
          <Button variant="ghost" disabled={stepIndex === 0} onClick={goBack}>
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
          {stepIndex < ctx.steps.length - 1 ? (
            <Button onClick={goNext} className="bg-[#0f1a5a] hover:bg-[#091133]">
              Continuar
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button disabled variant="outline">
              Flujo finalizado
            </Button>
          )}
        </div>
      }
    >
      <div className="mx-auto max-w-[1400px] animate-slide-up space-y-5">
        <div className="flow-page-header">
          <p className="flow-page-kicker">Flujo configurable por producto</p>
          <h1 className="flow-page-title">
            Así verá el cliente la emisión de{' '}
            <span className="text-primary">{product.commercialName}</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Ramo {branchMeta.label} · {ctx.steps.length} pasos activos según la configuración
          </p>
        </div>

        <div className="flow-card p-4 sm:p-5">
          <FlowStepper
            steps={ctx.steps}
            currentIndex={stepIndex}
            completedThrough={stepIndex - 1}
            onStepClick={(i) => i <= stepIndex && setStepIndex(i)}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="flow-card">
            <div className="flow-card-header">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  {currentStep?.label}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {currentStep?.description}
                </p>
              </div>
              <span className="flow-step-badge">
                Paso {stepIndex + 1} de {ctx.steps.length}
              </span>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              {stepId === 'CLIENT_DATA' && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Formulario · {currentStep?.label}
                  </p>
                  <StepFormGrid
                    fields={
                      ctx.fieldsByStep.CLIENT_DATA?.length
                        ? ctx.fieldsByStep.CLIENT_DATA
                        : ctx.clientFields
                    }
                    fallback={[
                      { label: 'Razón social / Tomador' },
                      { label: 'RIF' },
                      { label: 'Representante legal' },
                      { label: 'Cédula representante' },
                      { label: 'Teléfono' },
                      { label: 'Correo' },
                    ]}
                  />
                  <GuideBanner>
                    Campos configurados en el wizard, paso 5 → bloque «Formulario del paso:{' '}
                    {currentStep?.label}».
                  </GuideBanner>
                </>
              )}

              {stepId === 'RISK_DATA' && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Formulario · {ctx.riskStepTitle}
                  </p>
                  <p className="text-sm text-muted-foreground">{ctx.riskStepSubtitle}</p>
                  <StepFormGrid
                    fields={ctx.fieldsByStep.RISK_DATA ?? []}
                    fallback={ctx.riskFields.map((f) => ({ label: f.label }))}
                  />
                  {ctx.inspectionRequired && (
                    <div className="grid gap-3 sm:grid-cols-4">
                      {['Antigüedad', 'Factor riesgo', 'Zona', 'Riesgo calculado'].map((label, i) => (
                        <div key={label} className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {label}
                          </p>
                          <p className="mt-1 text-sm font-bold">
                            {['28 años', '1.18x', 'Zona 3', 'Medio alto'][i]}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {stepId === 'PLANS_COVERAGES' && (
                <>
                  {plans.length === 0 ? (
                    <Alert variant="warning">
                      Este producto no tiene planes activos guardados. Configúralos en el paso
                      «Planes comerciales» del wizard y pulsa «Guardar y continuar» antes de
                      abrir la vista previa.
                    </Alert>
                  ) : (
                    <div className="plan-card-grid">
                      {plans.map((plan, i) => (
                        <button
                          key={`${plan.name}-${i}`}
                          type="button"
                          onClick={() => setSelectedPlan(i)}
                          className={cn(
                            'plan-card text-left',
                            selectedPlan === i && 'plan-card-selected',
                          )}
                        >
                          <Badge className="border-border text-[10px]">
                            {plan.badge}
                          </Badge>
                          <p className="mt-2 font-semibold">{plan.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {labelAssignedChannel(plan.assignedChannel)}
                          </p>
                          <p className="mt-1 text-lg font-bold text-primary tabular-nums">
                            {currencySymbol(product.currency)}{' '}
                            {plan.price.toFixed(2)}
                          </p>
                          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                            {(plan.coverages ?? []).map((c) => (
                              <li key={c} className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                {c}
                              </li>
                            ))}
                          </ul>
                        </button>
                      ))}
                    </div>
                  )}
                  <GuideBanner>
                    Solo se muestran los planes activos guardados en el producto. El pago no se
                    solicita aquí: el cliente elige plan y avanza a documentos y firma.
                  </GuideBanner>
                </>
              )}

              {stepId === 'DOCUMENTS_OCR' && (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      {ctx.documents.filter((d) => d.required).length} obligatorio(s) ·{' '}
                      {ctx.documents.filter((d) => !d.required).length} opcional(es)
                    </p>
                    <Badge className="border-border">
                      <FileUp className="mr-1 h-3 w-3" />
                      OCR automático
                    </Badge>
                  </div>
                  <div className="doc-upload-grid">
                    {ctx.documents.length === 0 ? (
                      <GuideBanner>
                        Este producto no tiene documentos configurados. Defínelos en el paso
                        legal del constructor.
                      </GuideBanner>
                    ) : (
                      ctx.documents.map((doc) => (
                        <div
                          key={doc.documentKey}
                          className={cn(
                            'doc-upload-card',
                            doc.required && 'doc-upload-card-required',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold">{doc.label}</p>
                            <Badge
                              variant={doc.required ? 'submitted' : 'default'}
                              className="text-[10px]"
                            >
                              {doc.required ? 'Obligatorio' : 'Opcional'}
                            </Badge>
                          </div>
                          <div className="mt-3 flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-card py-6 text-center">
                            <Upload className="h-5 w-5 text-muted-foreground" />
                            <p className="mt-2 text-xs text-muted-foreground">
                              Arrastra JPG, PNG o PDF
                            </p>
                          </div>
                          <p className="mt-2 text-[10px] font-medium uppercase tracking-wider text-amber-700">
                            Pendiente
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

              {stepId === 'DIGITAL_SIGNATURE' && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Firmante autorizado" placeholder="María Fernanda Rivas" />
                    <Field label="Documento de identidad" placeholder="V-12.458.902" />
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/15 p-4 text-sm text-muted-foreground">
                    Declaro que la información suministrada es veraz y autorizo la inspección técnica
                    del riesgo conforme a las condiciones del producto.
                  </div>
                  <div className="flex h-36 items-center justify-center rounded-xl border-2 border-dashed border-border/70 bg-card">
                    <PenLine className="mr-2 h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Área de firma digital</span>
                  </div>
                </>
              )}

              {stepId === 'AI_INSPECTION' && (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {['Fachada principal', 'Acceso / lobby', 'Sistema eléctrico', 'Áreas comunes', 'Sistema contra incendios', 'Estacionamiento'].map(
                      (label) => (
                        <div
                          key={label}
                          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/15 py-8"
                        >
                          <Camera className="h-5 w-5 text-muted-foreground" />
                          <p className="mt-2 text-xs font-medium">{label}</p>
                          <p className="mt-1 text-[10px] uppercase tracking-wider text-primary">
                            Requerida
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                  <Button className="w-full bg-[#0f1a5a] hover:bg-[#091133]">
                    Ejecutar análisis de IA y recomendación técnica
                  </Button>
                </>
              )}

              {stepId === 'TECHNICAL_APPROVAL' && (
                <div className="space-y-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-violet-100">
                    <CheckCircle2 className="h-8 w-8 text-violet-600" />
                  </div>
                  <p className="text-lg font-semibold">Solicitud técnica enviada</p>
                  <dl className="mx-auto max-w-md space-y-2 text-left text-sm">
                    <Row label="Número de solicitud" value={`${product.internalCode}-2026`} />
                    <Row label="Estado" value="En revisión técnica" />
                    <Row label="Prima estimada" value={ctx.totalEstimate} />
                  </dl>
                  <GuideBanner>
                    El pago se habilitará cuando el área técnica apruebe la solicitud.
                  </GuideBanner>
                </div>
              )}

              {stepId === 'PAYMENT' && (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {['Pago completo', 'Pago fraccionado', 'Domiciliación'].map((m, i) => (
                      <div
                        key={m}
                        className={cn(
                          'rounded-xl border p-4 text-center',
                          i === 0 ? 'border-primary/40 bg-primary/5' : 'border-border/60',
                        )}
                      >
                        <CreditCard className="mx-auto h-5 w-5 text-muted-foreground" />
                        <p className="mt-2 text-sm font-semibold">{m}</p>
                      </div>
                    ))}
                  </div>
                  <Button className="w-full bg-[#E84F51] hover:bg-[#d3474a]">
                    Simular pago validado
                  </Button>
                </>
              )}

              {stepId === 'FINISHED' && (
                <div className="space-y-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </div>
                  <p className="text-lg font-semibold">Flujo finalizado: póliza emitida</p>
                  <dl className="mx-auto max-w-md space-y-2 text-left text-sm">
                    <Row label="Número de póliza" value={`LM-${product.internalCode}-2026`} />
                    <Row label="Estado" value="Emitida / Activa" />
                    <Row label="Prima pagada" value={ctx.totalEstimate} />
                  </dl>
                  <Button asChild variant="outline">
                    <Link to={`/products/${product.id}`}>Volver a configuración</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="xl:sticky xl:top-24 xl:self-start">
            <LiveSummary
              lines={ctx.summaryLines}
              total={ctx.totalEstimate}
              paymentBlockedReason={ctx.paymentBlockedReason}
              steps={ctx.steps}
              currentStepIndex={stepIndex}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function StepFormGrid({
  fields,
  fallback = [],
}: {
  fields: ProductFormField[];
  fallback?: { label: string }[];
}) {
  const list = fields.length > 0 ? fields : fallback;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {list.map((f) => (
        <Field key={f.label} label={f.label} placeholder={f.label} />
      ))}
    </div>
  );
}

function Field({
  label,
  placeholder,
  span,
}: {
  label: string;
  placeholder: string;
  span?: 'full' | 'half';
}) {
  return (
    <label className={cn('block', span === 'full' && 'sm:col-span-2')}>
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <Input placeholder={placeholder} readOnly className="bg-muted/20" />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/40 pb-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
