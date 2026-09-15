import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Save } from 'lucide-react';
import { api } from '@/lib/api';
import {
  defaultPlanPayload,
  inferPlanType,
  normalizePlanPayloadForApi,
  SIS2000_DEFAULT_PRODUCTOR,
  type Sis2000PlanType,
} from '@/lib/sis2000-nest-api';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const navigate = useNavigate();

  const queryCproducto = searchParams.get('cproducto')?.trim() ?? '';
  const queryCramo = searchParams.get('cramo')?.trim() ?? '';
  const queryType = (searchParams.get('type')?.trim() ?? 'personas') as Sis2000PlanType;

  const [jsonText, setJsonText] = useState('');
  const [planType, setPlanType] = useState<Sis2000PlanType>('personas');
  const [cproductoQuick, setCproductoQuick] = useState(queryCproducto || 'TST908');
  const [cramoQuick, setCramoQuick] = useState(queryCramo || '8');
  const [cproductorQuick, setCproductorQuick] = useState(String(SIS2000_DEFAULT_PRODUCTOR));
  const [cplanQuick, setCplanQuick] = useState('');
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
        cramo: opts?.cramo ?? (Number(cramoQuick) || 8),
        cproducto: opts?.cproducto ?? cproductoQuick,
        cproductor: opts?.cproductor ?? (Number(cproductorQuick) || SIS2000_DEFAULT_PRODUCTOR),
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
        let cramo = Number(queryCramo) || 8;
        const cproducto = queryCproducto || 'TST908';
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
        setCramoQuick(String(cramo));
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
        setCramoQuick(String(match.cramo ?? '8'));
        setCproductoQuick(String(match.cproducto ?? '').trim() || 'TST908');
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
      parsed.cramo = Number(cramoQuick) || 8;
      parsed.cplan = cplanQuick.trim();
      if (parsed.all_productor !== true) {
        parsed.all_productor = false;
        parsed.all_canal = false;
        parsed.productores = [
          { cproductor: Number(cproductorQuick) || SIS2000_DEFAULT_PRODUCTOR },
        ];
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
      if (isEdit && id) {
        await api.updateSis2000MasterPlan(id, payload);
        setSuccess(`Plan ${id} actualizado (visibilidad productor incluida)`);
      } else {
        await api.createSis2000MasterPlan(payload);
        setSuccess('Plan creado en Sis2000 con visibilidad para valrep');
        navigate('/sis2000/plans');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar plan');
    } finally {
      setSaving(false);
    }
  }

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
        POST/PUT nest-api /api/v1/partner/starter/plan → spMantPlanes + mausuplan (productores)
      </p>
      <p className="mb-4 text-xs text-amber-800 dark:text-amber-200">
        Incluye productores para que el plan aparezca en valrep (P / 80080). Solo catálogo — no
        emite pólizas.
      </p>

      {error && <Alert variant="error" className="mb-3">{error}</Alert>}
      {success && <Alert variant="success" className="mb-3">{success}</Alert>}

      <div className="mb-4 grid gap-3 rounded-lg border border-border/50 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label>Tipo plan</Label>
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
          <Label htmlFor="cproducto-q">cproducto</Label>
          <Input
            id="cproducto-q"
            value={cproductoQuick}
            onChange={(e) => setCproductoQuick(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="cramo-q">cramo</Label>
          <Input id="cramo-q" value={cramoQuick} onChange={(e) => setCramoQuick(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cplan-q">cplan</Label>
          <Input
            id="cplan-q"
            value={cplanQuick}
            onChange={(e) => setCplanQuick(e.target.value)}
            placeholder="T908V5"
          />
        </div>
        <div>
          <Label htmlFor="cprod-q">cproductor (visibilidad)</Label>
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

      <Button type="button" onClick={save} disabled={saving || loadingInit}>
        <Save className="h-4 w-4" />
        {saving ? 'Guardando…' : isEdit ? 'Actualizar plan' : 'Crear plan'}
      </Button>
    </AppShell>
  );
}
