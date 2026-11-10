import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calculator, RefreshCw, Save } from 'lucide-react';
import { api } from '@/lib/api';
import {
  defaultPlanPayload,
  inferPlanType,
  normalizePlanPayloadForApi,
  sis2000PlanMasterId,
  SIS2000_DEFAULT_PRODUCTOR,
  validatePlanPayload,
  type Sis2000NestRow,
  type Sis2000PlanType,
} from '@/lib/sis2000-nest-api';
import { AppShell } from '@/components/layout/AppShell';
import {
  PRODUCTORES_DEFAULT,
  ProductoresSelector,
  productoresFromPayload,
  productoresToPayloadFields,
  type ProductoresSelection,
} from '@/components/sis2000/ProductoresSelector';
import {
  CANALES_DEFAULT,
  CanalesSelector,
  canalesFromPayload,
  canalesToPayloadFields,
  type CanalesSelection,
} from '@/components/sis2000/CanalesSelector';
import { HistorialPanel } from '@/components/sis2000/HistorialPanel';
import { ProveedoresPlanPanel } from '@/components/sis2000/ProveedoresPlanPanel';
import { CobroDiasPanel } from '@/components/sis2000/CobroDiasPanel';
import { claveHistorial } from '@/lib/sis2000-historial';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InfoTip } from '@/components/ui/info-tip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function Sis2000PlanFormPage() {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);

  const queryCproducto = searchParams.get('cproducto')?.trim() ?? '';
  const queryCramo = searchParams.get('cramo')?.trim() ?? '';
  const queryType = (searchParams.get('type')?.trim() ?? 'personas') as Sis2000PlanType;

  const [jsonText, setJsonText] = useState('');
  const [planType, setPlanType] = useState<Sis2000PlanType>('personas');
  const [cproductoQuick, setCproductoQuick] = useState(queryCproducto);
  const [cramoQuick, setCramoQuick] = useState(queryCramo);
  /** Quién ve el plan en mausuplan: lista de productores (por defecto 80080) o todos (all_productor: true). */
  const [productoresSel, setProductoresSel] = useState<ProductoresSelection>(PRODUCTORES_DEFAULT);
  /** Canales alternos (mausuplan centidad C). Solo se muestran y envían si el servidor lo habilita. */
  const [canalesSel, setCanalesSel] = useState<CanalesSelection>(CANALES_DEFAULT);
  const [canalesHabilitados, setCanalesHabilitados] = useState(false);
  const [motivo, setMotivo] = useState('');
  /** Sube al guardar: recarga el historial. */
  const [version, setVersion] = useState(0);
  /** Sube al restaurar: vuelve a leer el plan de Sis2000. */
  const [recargarDatos, setRecargarDatos] = useState(0);
  /** Plan creado en esta pantalla (para mostrar historial y proveedores sin salir). */
  const [creadoId, setCreadoId] = useState<string | null>(null);
  const [cplanQuick, setCplanQuick] = useState('');
  const [cotizando, setCotizando] = useState(false);
  const [cotizacion, setCotizacion] = useState<Sis2000NestRow[] | null>(null);
  const [loadingFrec, setLoadingFrec] = useState(false);
  const [loadingInit, setLoadingInit] = useState(!isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [monedas, setMonedas] = useState<Array<Record<string, unknown>>>([]);

  const applyTemplate = useCallback(
    (opts?: {
      type?: Sis2000PlanType;
      cramo?: number;
      cproducto?: string;
      cproductor?: number;
      preserveCplan?: string;
    }) => {
      const type = opts?.type ?? planType;
      const prod = productoresToPayloadFields(productoresSel);
      const payload = defaultPlanPayload({
        type,
        cramo: opts?.cramo ?? (Number(cramoQuick) || undefined),
        cproducto: opts?.cproducto ?? cproductoQuick,
        cproductor: opts?.cproductor,
        productores: prod.productores,
        all_productor: prod.all_productor,
        cplan: opts?.preserveCplan ?? cplanQuick,
      });
      setJsonText(
        JSON.stringify(canalesHabilitados ? { ...payload, ...canalesToPayloadFields(canalesSel) } : payload, null, 2),
      );
    },
    [planType, cramoQuick, cproductoQuick, cplanQuick, productoresSel, canalesSel, canalesHabilitados],
  );

  useEffect(() => {
    void api.listSis2000CatalogMonedas().then(setMonedas).catch(() => undefined);
    void api
      .getSis2000Funciones()
      .then((f) => setCanalesHabilitados(f.canalesEnPlan === true))
      .catch(() => setCanalesHabilitados(false));
  }, []);

  useEffect(() => {
    if (isEdit) return;

    setLoadingInit(true);
    setError(null);
    void (async () => {
      try {
        let cramo = Number(queryCramo) || undefined;
        const cproducto = queryCproducto;
        if (queryCproducto) {
          try {
            const product = await api.getSis2000Product(queryCproducto);
            if (product.cramo != null) cramo = Number(product.cramo);
          } catch {
            /* usar cramo de query o default */
          }
        }
        const type: Sis2000PlanType = queryType === 'cosas' ? 'cosas' : 'personas';
        setCproductoQuick(cproducto);
        setCramoQuick(cramo ? String(cramo) : '');
        setPlanType(type);
        const payload = defaultPlanPayload({
          type,
          cramo,
          cproducto,
          cproductor: SIS2000_DEFAULT_PRODUCTOR,
        });
        setJsonText(JSON.stringify(payload, null, 2));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al inicializar plantilla');
      } finally {
        setLoadingInit(false);
      }
    })();
  }, [isEdit, queryCproducto, queryCramo, queryType]);

  useEffect(() => {
    if (!isEdit || !id) return;
    setError(null);
    void (async () => {
      try {
        const plans = await api.listSis2000MasterPlans();
        const [cramoPart, ...planParts] = id.split('-');
        const cplanPart = planParts.join('-');
        const match = plans.find(
          (p) =>
            String(p.cramo ?? '') === cramoPart &&
            String(p.cplan ?? '').trim() === cplanPart.trim(),
        );
        if (!match) {
          setError(`Plan ${id} no encontrado en catálogo maestro`);
          return;
        }
        setCplanQuick(String(match.cplan ?? ''));
        setCramoQuick(String(match.cramo ?? ''));
        setCproductoQuick(String(match.cproducto ?? '').trim());
        const merged = normalizePlanPayloadForApi({ ...match, operation: 'U' }, 'update');
        setPlanType(inferPlanType(merged));
        setProductoresSel(productoresFromPayload(merged as Record<string, unknown>));
        setCanalesSel(canalesFromPayload(merged as Record<string, unknown>));
        setJsonText(JSON.stringify(merged, null, 2));
        // Productores y canales reales de mausuplan (lectura completa del plan); si falla se queda lo del catálogo.
        try {
          const leido = await api.leerSis2000Plan(id);
          setProductoresSel(productoresFromPayload(leido.plan));
          setCanalesSel(canalesFromPayload(leido.plan));
        } catch {
          /* nest-api sin la lectura completa: se usan los datos del catálogo */
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar plan');
      }
    })();
  }, [id, isEdit, recargarDatos]);

  function mergeQuickFieldsIntoJson() {
    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      parsed.type = planType;
      parsed.cproducto = cproductoQuick.trim();
      parsed.cramo = Number(cramoQuick) || 0;
      parsed.cplan = cplanQuick.trim();
      const prod = productoresToPayloadFields(productoresSel);
      if (prod.all_productor) {
        parsed.all_productor = true;
        parsed.productores = [];
      } else if (prod.productores.length) {
        parsed.all_productor = false;
        parsed.all_canal = false;
        parsed.productores = prod.productores;
      }
      if (canalesHabilitados) Object.assign(parsed, canalesToPayloadFields(canalesSel));
      const normalized = normalizePlanPayloadForApi(parsed, isEdit ? 'update' : 'create');
      setJsonText(JSON.stringify(normalized, null, 2));
      setSuccess('Campos rápidos aplicados al JSON');
    } catch {
      setError('JSON inválido — corrige el texto antes de aplicar campos');
    }
  }

  async function loadFrecuencias() {
    setLoadingFrec(true);
    setError(null);
    try {
      const rows = await api.listSis2000PlanFrecuencias(
        cplanQuick.trim(),
        Number(cramoQuick) || undefined,
      );
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      parsed.frecuencias = rows.map((r) => ({
        ifrecuencia: String(r.ifrecuencia ?? r.cfre ?? ''),
        xfrecuencia: String(r.xfrecuencia ?? r.xfre ?? ''),
        ndias: Number(r.ndias ?? r.ndia ?? 0) || undefined,
      }));
      setJsonText(JSON.stringify(parsed, null, 2));
      setSuccess(`Frecuencias cargadas (${rows.length}) desde valrep/frecuencia`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar frecuencias');
    } finally {
      setLoadingFrec(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const raw = JSON.parse(jsonText) as Record<string, unknown>;
      // Los canales elegidos en el selector van siempre (sin tener que «Aplicar campos al JSON»).
      if (canalesHabilitados) Object.assign(raw, canalesToPayloadFields(canalesSel));
      const payload = normalizePlanPayloadForApi(raw, isEdit ? 'update' : 'create');
      const errores = validatePlanPayload(payload);
      if (errores.length) {
        setError(errores.join(' '));
        return;
      }
      const cuerpo = { ...payload, motivoCambio: motivo || undefined };
      if (isEdit && id) {
        await api.updateSis2000MasterPlan(id, cuerpo);
        setSuccess(`Plan ${id} actualizado (visibilidad productor incluida; lo anterior quedó en el historial)`);
      } else {
        await api.createSis2000MasterPlan(cuerpo);
        setSuccess(`Plan ${String(payload.cplan)} creado en Sis2000. Puedes cotizarlo y asignarle proveedores antes de salir.`);
        setCplanQuick(String(payload.cplan));
        setCramoQuick(String(payload.cramo));
        setCreadoId(sis2000PlanMasterId(Number(payload.cramo), String(payload.cplan)));
      }
      setMotivo('');
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar plan');
    } finally {
      setSaving(false);
    }
  }

  /** Solo planes de cosas: spCalculoRiesgoGeneral con suma y prima de maplantar. */
  async function cotizar() {
    setCotizando(true);
    setError(null);
    setCotizacion(null);
    try {
      const rows = await api.cotizarSis2000Plan(Number(cramoQuick), cplanQuick.trim());
      if (!rows.length) {
        setError('La cotización no devolvió coberturas: revisa que el plan exista y tenga suma y prima.');
        return;
      }
      setCotizacion(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cotizar plan');
    } finally {
      setCotizando(false);
    }
  }

  /** "cramo-cplan" del plan que ya existe en Sis2000 (editando o recién creado aquí). */
  const planId = isEdit && id ? id : creadoId;

  /** Coberturas y moneda del JSON del plan (para el tipo de emisión «Cobro por días»). */
  const datosJson = useMemo(() => {
    try {
      const p = JSON.parse(jsonText) as { cmoneda?: unknown; coberturas?: unknown };
      const coberturas = (Array.isArray(p.coberturas) ? (p.coberturas as Array<Record<string, unknown>>) : [])
        .map((c) => ({
          ccobertura: String(c?.ccobertura ?? c?.ccober ?? '').trim(),
          nombre: String(c?.xcobertura ?? c?.xdescripcion_l ?? c?.xdescripcion ?? '').trim(),
        }))
        .filter((c) => c.ccobertura);
      return { coberturas, cmoneda: String(p.cmoneda ?? '').trim() || '$' };
    } catch {
      return { coberturas: [] as Array<{ ccobertura: string; nombre: string }>, cmoneda: '$' };
    }
  }, [jsonText]);

  const totalCotizacion = (campo: string) =>
    (cotizacion ?? []).reduce((s, r) => s + (Number(r[campo]) || 0), 0);

  return (
    <AppShell title={isEdit ? 'Editar plan Sis2000' : 'Nuevo plan Sis2000'}>
      <Link
        to="/sis2000/plans"
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Planes maestro
      </Link>

      <h1 className="mb-1 text-lg font-bold">
        {isEdit ? `Editar plan ${id}` : 'Crear plan maestro'}
      </h1>
      <p className="mb-1 text-xs text-muted-foreground">
        POST/PUT nest-api /api/v1/configurador/planes → spMantPlanes + mausuplan (productores)
      </p>
      <p className="mb-4 text-xs text-amber-800 dark:text-amber-200">
        Indica los productores que pueden vender el plan (o all_productor: true). En planes de cosas
        cada cobertura lleva prima fija (mprima) o tasa (pprima, en %); si su suma se calcula al
        emitir, agrega <code>&quot;suma_calculada&quot;: true</code> a la cobertura y deja suma, prima y
        tasa en 0. Solo catálogo — no emite pólizas.
      </p>

      {error && <Alert variant="error" className="mb-3">{error}</Alert>}
      {success && <Alert variant="success" className="mb-3">{success}</Alert>}

      <div className="mb-4 grid gap-3 rounded-lg border border-border/50 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <div className="flex items-center gap-1.5">
            <Label>Tipo de plan</Label>
            <InfoTip text="Personas (vida, salud, funerario…): tarifa por edad y parentesco. Cosas (vehículos, patrimoniales…): suma asegurada con prima fija o tasa por cobertura. Cambia qué tablas de Sis2000 se llenan." />
          </div>
          <Select value={planType} onValueChange={(v) => setPlanType(v as Sis2000PlanType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="personas">personas</SelectItem>
              <SelectItem value="cosas">cosas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="cproducto-q">Producto (cproducto)</Label>
            <InfoTip text="Código del producto de Sis2000 al que pertenece el plan." />
          </div>
          <Input
            id="cproducto-q"
            value={cproductoQuick}
            onChange={(e) => setCproductoQuick(e.target.value)}
          />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="cramo-q">Ramo (cramo)</Label>
            <InfoTip text="Ramo del plan. Las coberturas y tarifas que uses deben existir en este ramo." />
          </div>
          <Input id="cramo-q" value={cramoQuick} onChange={(e) => setCramoQuick(e.target.value)} />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="cplan-q">Código de plan (cplan)</Label>
            <InfoTip text="Clave del plan dentro del ramo. Junto con el ramo identifica el plan; también se usa para cotizar y cargar frecuencias." />
          </div>
          <Input
            id="cplan-q"
            value={cplanQuick}
            onChange={(e) => setCplanQuick(e.target.value)}
            placeholder="T908V5"
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <div className="flex items-center gap-1.5">
            <Label>Productores que pueden vender el plan</Label>
            <InfoTip text="Busca por nombre o código y selecciona uno o varios productores (mausuplan); por defecto 80080. «Todos» lo habilita para todos (all_productor: true). Se aplica con «Aplicar campos al JSON» o «Plantilla completa»." />
          </div>
          <ProductoresSelector idPrefix="plan-prod" value={productoresSel} onChange={setProductoresSel} />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <div className="flex items-center gap-1.5">
            <Label>Canales alternos que pueden vender el plan</Label>
            <InfoTip text="Busca por nombre o código y selecciona uno o varios canales alternos (mausuplan, entidad C); «Todos» lo habilita para todos los canales (all_canal: true). Sin canales, el plan solo se vende por productores. Se aplica con «Aplicar campos al JSON» o «Plantilla completa». Los canales solo se agregan al plan: nunca se borran." />
          </div>
          <CanalesSelector
            idPrefix="plan-canal"
            value={canalesSel}
            onChange={setCanalesSel}
            deshabilitado={!canalesHabilitados}
          />
        </div>
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3">
          <Button type="button" variant="outline" size="sm" onClick={() => applyTemplate()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Plantilla completa
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={mergeQuickFieldsIntoJson}>
            Aplicar campos al JSON
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadFrecuencias}
            disabled={loadingFrec}
          >
            Cargar frecuencias valrep
          </Button>
          <InfoTip className="self-center" text="Plantilla completa: rehace el JSON con los campos rápidos (pierdes lo editado). Aplicar campos: copia los campos rápidos al JSON actual. Cargar frecuencias: trae de Sis2000 las frecuencias de pago del plan." />
        </div>
      </div>

      {monedas.length > 0 && (
        <p className="mb-2 text-xs text-muted-foreground">
          Monedas: {monedas.slice(0, 6).map((m) => String(m.cmoneda ?? m.codigo ?? '')).join(', ')}
          {monedas.length > 6 ? '…' : ''}
        </p>
      )}

      {loadingInit ? (
        <div className="mb-4 min-h-[420px] animate-pulse rounded-lg bg-muted/60" />
      ) : (
        <textarea
          className="mb-4 min-h-[420px] w-full rounded-lg border border-border bg-background p-3 font-mono text-xs"
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          spellCheck={false}
        />
      )}

      <div className="mb-3 max-w-xl">
        <Label htmlFor="plan-motivo">Motivo del cambio (opcional, queda en el historial)</Label>
        <Input id="plan-motivo" value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={save} disabled={saving || loadingInit}>
          <Save className="h-4 w-4" />
          {saving ? 'Guardando…' : isEdit ? 'Actualizar plan' : 'Crear plan'}
        </Button>
        {planType === 'cosas' && (
          <Button
            type="button"
            variant="outline"
            onClick={cotizar}
            disabled={cotizando || !cplanQuick.trim() || !(Number(cramoQuick) > 0)}
          >
            <Calculator className="h-4 w-4" />
            {cotizando ? 'Cotizando…' : 'Cotizar plan'}
          </Button>
        )}
      </div>

      {cotizacion && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border/50">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-2">Cobertura</th>
                <th className="p-2 text-right">Suma asegurada</th>
                <th className="p-2 text-right">Prima</th>
                <th className="p-2 text-right">Comisión</th>
              </tr>
            </thead>
            <tbody>
              {cotizacion.map((r) => (
                <tr key={String(r.ccober)} className="border-t border-border/50">
                  <td className="p-2">{String(r.ccober ?? '').trim()} · {String(r.xcobertura ?? '').trim()}</td>
                  <td className="p-2 text-right">{Number(r.msumaasegext ?? 0).toLocaleString('es-VE')}</td>
                  <td className="p-2 text-right">{Number(r.mprimaext ?? 0).toLocaleString('es-VE')}</td>
                  <td className="p-2 text-right">{Number(r.mcomisionext ?? 0).toLocaleString('es-VE')}</td>
                </tr>
              ))}
              <tr className="border-t border-border font-semibold">
                <td className="p-2">Total (moneda del plan)</td>
                <td className="p-2" />
                <td className="p-2 text-right">{totalCotizacion('mprimaext').toLocaleString('es-VE')}</td>
                <td className="p-2 text-right">{totalCotizacion('mcomisionext').toLocaleString('es-VE')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Visible también antes de crear el plan: lo elegido queda pendiente y se agrega al crearlo. */}
      <ProveedoresPlanPanel planId={planId} onCambio={() => setVersion((v) => v + 1)} />
      <CobroDiasPanel planId={planId} coberturas={datosJson.coberturas} cmonedaDefault={datosJson.cmoneda} />
      {planId && (
        <>
          <HistorialPanel
            entidad="PLAN"
            clave={claveHistorial.plan(planId.split('-')[0], planId.split('-').slice(1).join('-'))}
            recargar={version}
            onRestaurado={() => setRecargarDatos((n) => n + 1)}
          />
          <HistorialPanel
            titulo="Historial de proveedores"
            entidad="PLAN_PROVEEDORES"
            clave={claveHistorial.plan(planId.split('-')[0], planId.split('-').slice(1).join('-'))}
            recargar={version}
          />
        </>
      )}
    </AppShell>
  );
}
