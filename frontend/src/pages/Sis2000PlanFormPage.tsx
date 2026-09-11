import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { api } from '@/lib/api';
import type { Sis2000CreatePlanPayload } from '@/lib/sis2000-nest-api';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DEFAULT_PAYLOAD: Sis2000CreatePlanPayload = {
  type: 'plan',
  operation: 'I',
  cusuario: 4,
  cplan: '',
  xplan: '',
  fdesde: '2020-01-01',
  fhasta: '2099-12-31',
  cramo: 18,
  cmoneda: 'USD',
  cproducto: '24',
  idevolucion: 'N',
  itiporen: 'N',
  coberturas: [{ ccobertura: '15', ctarifa: '1' }],
  frecuencias: [{ ifrecuencia: 'A', xfrecuencia: 'Anual', ndias: 365 }],
};

export function Sis2000PlanFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [jsonText, setJsonText] = useState(JSON.stringify(DEFAULT_PAYLOAD, null, 2));
  const [cplanQuick, setCplanQuick] = useState('');
  const [cramoQuick, setCramoQuick] = useState('18');
  const [loadingFrec, setLoadingFrec] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [monedas, setMonedas] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    void api.listSis2000CatalogMonedas().then(setMonedas).catch(() => undefined);
  }, []);

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
        setCramoQuick(String(match.cramo ?? '18'));
        setJsonText(JSON.stringify({ ...match, operation: 'U', type: 'plan' }, null, 2));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar plan');
      }
    })();
  }, [id, isEdit]);

  async function loadFrecuencias() {
    setLoadingFrec(true);
    setError(null);
    try {
      const rows = await api.listSis2000PlanFrecuencias(
        cplanQuick.trim(),
        Number(cramoQuick) || undefined,
      );
      const parsed = JSON.parse(jsonText) as Sis2000CreatePlanPayload;
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
      const payload = JSON.parse(jsonText) as Record<string, unknown>;
      if (isEdit && id) {
        payload.operation = 'U';
        await api.updateSis2000MasterPlan(id, payload);
        setSuccess(`Plan ${id} actualizado`);
      } else {
        await api.createSis2000MasterPlan(payload);
        setSuccess('Plan creado en Sis2000');
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
        POST/PUT nest-api /api/v1/partner/starter/plan → spMantPlanes (catálogo maplanes)
      </p>
      <p className="mb-4 text-xs text-amber-800 dark:text-amber-200">
        Mantenimiento de plan en Sis2000 — no emite pólizas.
      </p>

      {error && <Alert variant="error" className="mb-3">{error}</Alert>}
      {success && <Alert variant="success" className="mb-3">{success}</Alert>}

      <div className="mb-4 grid gap-3 rounded-lg border border-border/50 p-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="cplan-frec">cplan (frecuencias)</Label>
          <Input
            id="cplan-frec"
            value={cplanQuick}
            onChange={(e) => setCplanQuick(e.target.value)}
            placeholder="RCVBAS"
          />
        </div>
        <div>
          <Label htmlFor="cramo-frec">cramo</Label>
          <Input
            id="cramo-frec"
            value={cramoQuick}
            onChange={(e) => setCramoQuick(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button type="button" variant="outline" onClick={loadFrecuencias} disabled={loadingFrec}>
            Cargar frecuencias valrep
          </Button>
        </div>
      </div>

      {monedas.length > 0 && (
        <p className="mb-2 text-xs text-muted-foreground">
          Monedas disponibles: {monedas.slice(0, 6).map((m) => String(m.cmoneda ?? m.codigo ?? '')).join(', ')}
          {monedas.length > 6 ? '…' : ''}
        </p>
      )}

      <textarea
        className="mb-4 min-h-[420px] w-full rounded-lg border border-border bg-background p-3 font-mono text-xs"
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
        spellCheck={false}
      />

      <Button type="button" onClick={save} disabled={saving}>
        <Save className="h-4 w-4" />
        {saving ? 'Guardando…' : isEdit ? 'Actualizar plan' : 'Crear plan'}
      </Button>
    </AppShell>
  );
}
