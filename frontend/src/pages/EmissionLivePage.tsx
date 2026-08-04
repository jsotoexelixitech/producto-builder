import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileUp,
  Loader2,
  Shield,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  branchHasVehicle,
  buildFormFromOcr,
  resolveEmissionDocuments,
  type EmissionFormData,
  type OcrDocType,
  type OcrFields,
} from '@/lib/emission-live';
import { emitPolicy, quote, uploadOcrDocument, type EmitResult } from '@/lib/emission-bridge-api';
import { enrichPlansWithCoverages, resolvePlanDisplayPrice } from '@/lib/product-plans';
import type { Product, ProductPlan } from '@/types/product';
import { EmissionShell } from '@/components/emission/EmissionShell';
import { Alert } from '@/components/ui/alert';
import { BRANCH_META } from '@/lib/constants';
import { cn } from '@/lib/utils';

type WizardStep = 'ocr' | 'datos' | 'planes' | 'pago' | 'listo';

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'ocr', label: 'OCR' },
  { id: 'datos', label: 'Datos' },
  { id: 'planes', label: 'Planes' },
  { id: 'pago', label: 'Pago' },
  { id: 'listo', label: 'Emitida' },
];

type DocStatus = 'idle' | 'uploading' | 'done' | 'error';

export function EmissionLivePage() {
  const { productId } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<WizardStep>('ocr');
  const [docStatus, setDocStatus] = useState<Record<string, DocStatus>>({});
  const [docProgress, setDocProgress] = useState<Record<string, number>>({});
  const [docErrors, setDocErrors] = useState<Record<string, string>>({});
  const [ocrData, setOcrData] = useState<Partial<Record<OcrDocType, OcrFields>>>({});
  const [form, setForm] = useState<EmissionFormData | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ProductPlan | null>(null);
  const [quotePreview, setQuotePreview] = useState<Awaited<ReturnType<typeof quote>> | null>(null);
  const [emitting, setEmitting] = useState(false);
  const [emitResult, setEmitResult] = useState<EmitResult | null>(null);
  const [paySimulating, setPaySimulating] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const p = await api.getProduct(id);
      setProduct(p);
      const docs = resolveEmissionDocuments(p);
      const initial: Record<string, DocStatus> = {};
      docs.forEach((d) => {
        initial[d.ocrType] = 'idle';
      });
      setDocStatus(initial);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar producto');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (productId) load(productId);
  }, [productId, load]);

  const docSlots = useMemo(
    () => (product ? resolveEmissionDocuments(product) : []),
    [product],
  );

  const plans = useMemo(() => {
    if (!product?.productPlans?.length) return [];
    return enrichPlansWithCoverages(
      product.productPlans.filter((p) => p.isActive !== false),
      product,
    );
  }, [product]);

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const isGuaranteed = product?.emissionType === 'EMISION_GARANTIZADA';
  const showVehicle = product ? branchHasVehicle(product.branch) : false;

  async function handleUpload(ocrType: OcrDocType, file: File) {
    setDocStatus((s) => ({ ...s, [ocrType]: 'uploading' }));
    setDocProgress((s) => ({ ...s, [ocrType]: 0 }));
    setDocErrors((s) => ({ ...s, [ocrType]: '' }));
    try {
      const result = await uploadOcrDocument(file, ocrType, (pct) => {
        setDocProgress((s) => ({ ...s, [ocrType]: pct }));
      });
      if (result.ocr && !result.ocrFailed) {
        setOcrData((prev) => ({
          ...prev,
          [ocrType]: result.ocr as OcrFields,
        }));
      }
      setDocStatus((s) => ({ ...s, [ocrType]: 'done' }));
    } catch (e) {
      setDocStatus((s) => ({ ...s, [ocrType]: 'error' }));
      setDocErrors((s) => ({
        ...s,
        [ocrType]: e instanceof Error ? e.message : 'Error OCR',
      }));
    }
  }

  function canLeaveOcr(): boolean {
    return docSlots
      .filter((d) => d.required)
      .every((d) => docStatus[d.ocrType] === 'done');
  }

  function goToDatos() {
    const built = buildFormFromOcr(ocrData);
    setForm(built);
    setStep('datos');
  }

  async function goToPlanes() {
    if (!form || !product) return;
    setStep('planes');
    if (selectedPlan) {
      try {
        const q = await quote(product.id, selectedPlan.name);
        setQuotePreview(q);
      } catch {
        setQuotePreview(null);
      }
    }
  }

  async function selectPlan(plan: ProductPlan) {
    setSelectedPlan(plan);
    if (!product) return;
    try {
      const q = await quote(product.id, plan.name);
      setQuotePreview(q);
    } catch {
      setQuotePreview(null);
    }
  }

  async function simulatePayAndEmit() {
    if (!product || !form || !selectedPlan) return;
    setPaySimulating(true);
    setEmitting(true);
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 900));
      const result = await emitPolicy(product, selectedPlan.name, form, true);
      setEmitResult(result);
      setStep('listo');
      window.open(result.documentUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al emitir');
    } finally {
      setPaySimulating(false);
      setEmitting(false);
    }
  }

  const stepPills = (
    <div className="flex flex-wrap gap-1.5">
      {STEPS.map((s, i) => (
        <span
          key={s.id}
          className={cn(
            'exelixi-step-pill',
            i < stepIndex && 'exelixi-step-pill-done',
            i === stepIndex && 'exelixi-step-pill-active',
            i > stepIndex && 'exelixi-step-pill-pending',
          )}
        >
          {i + 1}. {s.label}
        </span>
      ))}
    </div>
  );

  if (loading) {
    return (
      <EmissionShell backTo={{ href: '/emitir', label: 'Ramos' }} title="Cargando…">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--exelixi-orange)]" />
        </div>
      </EmissionShell>
    );
  }

  if (!product) {
    return (
      <EmissionShell backTo={{ href: '/emitir', label: 'Ramos' }} title="No encontrado">
        <Alert variant="error">{error ?? 'Producto no disponible'}</Alert>
      </EmissionShell>
    );
  }

  const branchMeta = BRANCH_META[product.branch];

  return (
    <EmissionShell
      backTo={{ href: '/emitir', label: 'Ramos' }}
      title={product.commercialName}
      subtitle={`${branchMeta.label} · ${product.internalCode}`}
      headerExtra={stepPills}
      footer={
        step !== 'listo' ? (
          <div className="mx-auto flex max-w-5xl justify-between gap-4">
            <button
              type="button"
              className="exelixi-btn-outline"
              disabled={step === 'ocr'}
              onClick={() => {
                const prev = STEPS[stepIndex - 1];
                if (prev) setStep(prev.id);
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Atrás
            </button>
            {step === 'ocr' && (
              <button
                type="button"
                className="exelixi-btn-primary"
                disabled={!canLeaveOcr()}
                onClick={goToDatos}
              >
                Continuar
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {step === 'datos' && (
              <button type="button" className="exelixi-btn-primary" onClick={goToPlanes}>
                Ver planes
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {step === 'planes' && (
              <button
                type="button"
                className="exelixi-btn-primary"
                disabled={!selectedPlan}
                onClick={() => setStep('pago')}
              >
                Ir a pago
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : undefined
      }
    >
      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      {step === 'ocr' && (
        <section className="space-y-4">
          <div className="exelixi-panel text-sm">
            <p className="font-bold text-[var(--exelixi-navy)]">
              Ramo: {branchMeta.label}
            </p>
            <p className="mt-1 text-[var(--exelixi-text-muted)]">
              Sube los documentos del producto. El OCR precargará tomador
              {showVehicle ? ' y vehículo' : ''} automáticamente.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {docSlots.map((slot) => (
              <DocUploadCard
                key={slot.ocrType}
                label={slot.label}
                required={slot.required}
                status={docStatus[slot.ocrType] ?? 'idle'}
                progress={docProgress[slot.ocrType] ?? 0}
                error={docErrors[slot.ocrType]}
                onFile={(f) => handleUpload(slot.ocrType, f)}
              />
            ))}
          </div>
        </section>
      )}

      {step === 'datos' && form && (
        <section className="exelixi-panel mx-auto max-w-xl space-y-4">
          <h2 className="text-lg font-bold text-[var(--exelixi-navy)]">
            Datos del tomador y riesgo
          </h2>
          <Field label="Tomador" value={form.tomadorNombre} onChange={(v) => setForm({ ...form, tomadorNombre: v })} />
          <Field label="Identificación tomador" value={form.tomadorId} onChange={(v) => setForm({ ...form, tomadorId: v })} />
          <Field label="Asegurado" value={form.aseguradoNombre} onChange={(v) => setForm({ ...form, aseguradoNombre: v })} />
          {showVehicle && (
            <>
              <Field label="Placa" value={form.placa} onChange={(v) => setForm({ ...form, placa: v })} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Marca" value={form.marca} onChange={(v) => setForm({ ...form, marca: v })} />
                <Field label="Modelo" value={form.modelo} onChange={(v) => setForm({ ...form, modelo: v })} />
                <Field label="Año" value={form.anio} onChange={(v) => setForm({ ...form, anio: v })} />
                <Field label="Serial" value={form.serial} onChange={(v) => setForm({ ...form, serial: v })} />
              </div>
            </>
          )}
        </section>
      )}

      {step === 'planes' && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--exelixi-navy)]">Planes del catálogo</h2>
          {plans.length === 0 ? (
            <Alert variant="warning">Este producto no tiene planes configurados.</Alert>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => {
                const price = resolvePlanDisplayPrice(plan, product);
                const selected = selectedPlan?.name === plan.name;
                return (
                  <button
                    key={plan.name}
                    type="button"
                    onClick={() => selectPlan(plan)}
                    className={cn('exelixi-card p-5 text-left', selected && 'exelixi-card-selected')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-[var(--exelixi-navy)]">{plan.name}</p>
                      {plan.isRecommended && (
                        <span className="exelixi-badge-ready">Top</span>
                      )}
                    </div>
                    <p className="exelixi-price mt-2">
                      {product.currency === 'USD' ? 'US$' : 'Bs.'}{' '}
                      {price.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </p>
                    <ul className="mt-3 space-y-1 text-xs text-[var(--exelixi-text-muted)]">
                      {(plan.coverageLabels ?? []).slice(0, 4).map((c) => (
                        <li key={c}>· {c}</li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
          )}
          {quotePreview && selectedPlan && (
            <div className="exelixi-quote-banner">
              <p className="font-bold">Cotización confirmada</p>
              <p>
                Plan {quotePreview.planName}:{' '}
                {quotePreview.moneda === 'USD' ? 'US$' : 'Bs.'}{' '}
                {quotePreview.primaTotal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}
        </section>
      )}

      {step === 'pago' && (
        <section className="exelixi-panel mx-auto max-w-md space-y-6 text-center">
          <div className="exelixi-success-icon mx-auto">
            <CreditCard className="h-8 w-8 text-[var(--exelixi-orange)]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--exelixi-navy)]">
              {isGuaranteed ? 'Emisión garantizada' : 'Simular pago'}
            </h2>
            <p className="mt-2 text-sm text-[var(--exelixi-text-muted)]">
              {isGuaranteed
                ? 'Sin pasarela real. La póliza se emite con estatus PAGADO.'
                : 'Modo prueba: simula el pago antes de emitir.'}
            </p>
          </div>
          {selectedPlan && quotePreview && (
            <p className="exelixi-price text-center">
              {quotePreview.moneda === 'USD' ? 'US$' : 'Bs.'}{' '}
              {quotePreview.primaTotal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
            </p>
          )}
          <button
            type="button"
            className="exelixi-btn-primary w-full py-3.5"
            disabled={emitting || !selectedPlan}
            onClick={simulatePayAndEmit}
          >
            {paySimulating || emitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Emitiendo…
              </>
            ) : (
              <>
                <Shield className="h-4 w-4" />
                Simular pago y emitir
              </>
            )}
          </button>
        </section>
      )}

      {step === 'listo' && emitResult && (
        <section className="mx-auto max-w-lg space-y-6 text-center">
          <div className="exelixi-success-icon mx-auto">
            <CheckCircle2 className="h-10 w-10 text-[var(--exelixi-orange)]" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--exelixi-navy)]">Póliza emitida</h2>
          <dl className="exelixi-panel space-y-2 text-left text-sm">
            <Row label="Número" value={emitResult.numeroPoliza} />
            <Row label="Producto" value={emitResult.productName ?? product.commercialName} />
            <Row label="Plan" value={emitResult.planName ?? selectedPlan?.name ?? '—'} />
            {emitResult.primaTotal != null && (
              <Row
                label="Prima"
                value={`${emitResult.moneda === 'USD' ? 'US$' : 'Bs.'} ${emitResult.primaTotal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`}
              />
            )}
          </dl>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <a
              href={emitResult.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="exelixi-btn-primary inline-flex py-3"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir cuadro-póliza (PDF)
            </a>
            <Link to="/emitir" className="exelixi-btn-outline inline-flex py-3">
              Emitir otro ramo
            </Link>
          </div>
        </section>
      )}
    </EmissionShell>
  );
}

function DocUploadCard({
  label,
  required,
  status,
  progress,
  error,
  onFile,
}: {
  label: string;
  required: boolean;
  status: DocStatus;
  progress: number;
  error?: string;
  onFile: (file: File) => void;
}) {
  const inputId = `doc-${label.replace(/\s+/g, '-')}`;
  return (
    <div className="exelixi-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-[var(--exelixi-navy)]">{label}</p>
        <span className={status === 'done' ? 'exelixi-badge-ready' : 'exelixi-badge-draft'}>
          {status === 'done' ? 'Listo' : required ? 'Obligatorio' : 'Opcional'}
        </span>
      </div>
      {status === 'uploading' && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--exelixi-bg)]">
          <div
            className="h-full bg-[var(--exelixi-orange)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {status !== 'done' && (
        <label htmlFor={inputId} className="exelixi-upload-zone mt-4">
          <FileUp className="h-5 w-5 text-[var(--exelixi-orange)]" />
          {status === 'uploading' ? 'Procesando…' : 'Subir archivo'}
          <input
            id={inputId}
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            disabled={status === 'uploading'}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
        </label>
      )}
      {status === 'done' && (
        <p className="mt-3 flex items-center gap-1 text-sm font-semibold text-[#0284c7]">
          <CheckCircle2 className="h-4 w-4" />
          Documento procesado
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-semibold text-[var(--exelixi-navy)]">{label}</span>
      <input
        className="exelixi-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--exelixi-border)] pb-2 last:border-0">
      <dt className="text-[var(--exelixi-text-muted)]">{label}</dt>
      <dd className="text-right font-bold text-[var(--exelixi-navy)]">{value}</dd>
    </div>
  );
}
