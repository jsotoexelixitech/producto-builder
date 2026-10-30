import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calculator, RefreshCw, Save } from 'lucide-react';
import { api } from '@/lib/api';
import {
  defaultPlanPayload,
  inferPlanType,
  normalizePlanPayloadForApi,
  validatePlanPayload,
  type Sis2000NestRow,
  type Sis2000PlanType,
} from '@/lib/sis2000-nest-api';
import { AppShell } from '@/components/layout/AppShell';
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
  const [cproductorQuick, setCproductorQuick] = useState('');
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
      const payload = defaultPlanPayload({
        type,
        cramo: opts?.cramo ?? (Number(cramoQuick) || undefined),
        cproducto: opts?.cproducto ?? cproductoQuick,
        cproductor: opts?.cproductor ?? (Number(cproductorQuick) || undefined),
        cplan: opts?.preserveCplan ?? cplanQuick,
      });
      setJsonText(JSON.stringify(payload, null, 2));
    },
    [planType, cramoQuick, cproductoQuick, cproductorQuick, cplanQuick],
  );

  useEffect(() => {
    void api.listSis2000CatalogMonedas().then(setMonedas).catch(() => undefined);
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
        const payload = defaultPlanPayload({ type, cramo, cproducto });
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
        setJsonText(JSON.stringify(merged, null, 2));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar plan');
      }
    })();
  }, [id, isEdit]);

  function mergeQuickFieldsIntoJson() {
    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      parsed.type = planType;
      parsed.cproducto = cproductoQuick.trim();
      parsed.cramo = Number(cramoQuick) || 0;
      parsed.cplan = cplanQuick.trim();
      if (parsed.all_productor !== true && Number(cproductorQuick) > 0) {
        parsed.all_productor = false;
        parsed.all_canal = false;
        parsed.productores = [{ cproductor: Number(cproductorQuick) }];
      }
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
      const payload = normalizePlanPayloadForApi(raw, isEdit ? 'update' : 'create');
      const errores = validatePlanPayload(payload);
      if (errores.length) {
        setError(errores.join(' '));
        return;
      }
      if (isEdit && id) {
        await api.updateSis2000MasterPlan(id, payload);
        setSuccess(`Plan ${id} actualizado (visibilidad productor incluida)`);
      } else {
        await api.createSis2000MasterPlan(payload);
        setSuccess(`Plan ${String(payload.cplan)} creado en Sis2000. Puedes cotizarlo antes de salir.`);
        setCplanQuick(String(payload.cplan));
        setCramoQuick(String(payload.cramo));
      }
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
        cada cobertura lleva prima fija (mprima) o tasa (pprima, en %). Solo catálogo — no emite
        pólizas.
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
        <div>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="cprod-q">Productor que puede venderlo (cproductor)</Label>
            <InfoTip text="Al pulsar «Aplicar campos al JSON» deja este productor como el único que ve el plan. Para varios productores edita la lista «productores» del JSON, o usa all_productor: true para todos." />
          </div>
          <Input
            id="cprod-q"
            value={cproductorQuick}
            onChange={(e) => setCproductorQuick(e.target.value)}
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
    </AppShell>
  );
}
