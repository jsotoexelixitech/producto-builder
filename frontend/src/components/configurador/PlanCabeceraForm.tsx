import { useEffect, useMemo, useState } from 'react';
import { FileText, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { advertenciasPorConfirmar } from '@/lib/configurador';
import { cabeceraDePlan, cambiosCabecera, validarCabecera, type CabeceraForm } from '@/lib/configurador-fase2';
import { entenderError, type ErrorEntendible } from '@/lib/errores';
import { ConfirmarDialog } from '@/components/sis2000/AsistentePasos';
import { Alert } from '@/components/ui/alert';
import { AlertaError } from '@/components/ui/errores';
import { Button } from '@/components/ui/button';
import { InfoTip } from '@/components/ui/info-tip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionPanel } from '@/components/ui/section-panel';
import { cn } from '@/lib/utils';

type Obj = Record<string, unknown>;
const SELECT = 'h-10 w-full rounded-md border border-border bg-background px-2 text-sm disabled:bg-slate-50';
const txt = (v: unknown) => (v == null ? '' : String(v).trim());

/**
 * Datos del plan (versión vigente): nombre, moneda, producto y estado. Solo se envía lo que cambió. Inactivar el
 * plan pide confirmar: deja de ofrecerse.
 */
export function PlanCabeceraForm({
  planId,
  plan,
  cramo,
  soloLectura,
  onCambio,
}: {
  planId: string;
  plan: Record<string, unknown> | null;
  cramo: number;
  soloLectura?: boolean;
  onCambio?: () => void;
}) {
  const original = useMemo(() => cabeceraDePlan(plan), [plan]);
  const [form, setForm] = useState<CabeceraForm>(original);
  const [monedas, setMonedas] = useState<Array<{ codigo: string; nombre: string }>>([]);
  const [productos, setProductos] = useState<Array<{ codigo: string; nombre: string }>>([]);
  const [error, setError] = useState<ErrorEntendible | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [intento, setIntento] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [confirmarInactivar, setConfirmarInactivar] = useState(false);
  const [porConfirmar, setPorConfirmar] = useState<string[] | null>(null);
  /** Base para «qué cambió»: lo leído o lo último guardado. */
  const [base, setBase] = useState<CabeceraForm>(original);

  useEffect(() => {
    setForm(original);
    setBase(original);
  }, [original]);

  useEffect(() => {
    api
      .listSis2000CatalogMonedas()
      .then((rows) => {
        const vistas = new Set<string>();
        const out: Array<{ codigo: string; nombre: string }> = [];
        for (const m of (rows ?? []) as Obj[]) {
          const codigo = txt(m.cmoneda ?? m.codigo ?? m.cvalor);
          if (!codigo || vistas.has(codigo)) continue;
          vistas.add(codigo);
          out.push({ codigo, nombre: txt(m.xmoneda ?? m.xdescripcion_l ?? m.xdescripcion ?? m.descripcion) });
        }
        setMonedas(out);
      })
      .catch(() => setMonedas([]));
    api
      .listSis2000Products()
      .then((rows) => {
        const vistos = new Set<string>();
        const out: Array<{ codigo: string; nombre: string }> = [];
        for (const p of rows ?? []) {
          const codigo = txt(p.cproducto);
          if (!codigo || codigo.length > 6 || Number(p.cramo) !== cramo || vistos.has(codigo.toUpperCase())) continue;
          vistos.add(codigo.toUpperCase());
          out.push({ codigo, nombre: txt(p.xdescripcion_l) });
        }
        setProductos(out.sort((a, b) => a.codigo.localeCompare(b.codigo)));
      })
      .catch(() => setProductos([]));
  }, [cramo]);

  // La moneda solo se valida contra el catálogo si se cambió (la leída puede no venir igual en el catálogo).
  const monedasValidas = form.cmoneda !== base.cmoneda ? monedas.map((m) => m.codigo) : [];
  const errores = intento ? validarCabecera(form, monedasValidas) : {};
  const cambios = cambiosCabecera(base, form);
  const hayCambios = Object.keys(cambios).length > 0;

  function intentarGuardar() {
    setIntento(true);
    setOk(null);
    if (Object.keys(validarCabecera(form, monedasValidas)).length) return;
    if (!hayCambios) {
      setOk('No hay cambios que guardar.');
      return;
    }
    if (cambios.iestado === 'I') {
      setConfirmarInactivar(true);
      return;
    }
    void guardar(false);
  }

  async function guardar(confirmar: boolean) {
    setGuardando(true);
    setError(null);
    setOk(null);
    setAvisos([]);
    try {
      const r = await api.editarSis2000CabeceraPlan(planId, { ...cambios, motivoCambio: motivo || undefined, ...(confirmar ? { confirmar: true } : {}) });
      const adv = advertenciasPorConfirmar(r, confirmar);
      if (adv.length) {
        setPorConfirmar(adv);
        return;
      }
      setPorConfirmar(null);
      setConfirmarInactivar(false);
      if (Array.isArray(r?.advertencias)) setAvisos(r.advertencias.map(String));
      setOk('Datos del plan guardados.');
      setBase(form);
      setMotivo('');
      setIntento(false);
      onCambio?.();
    } catch (e) {
      const adv = advertenciasPorConfirmar(e, confirmar);
      if (adv.length) setPorConfirmar(adv);
      else setError(entenderError(e, { titulo: 'No se pudieron guardar los datos del plan' }));
      setConfirmarInactivar(false);
    } finally {
      setGuardando(false);
    }
  }

  const productoFuera = form.cproducto && !productos.some((p) => p.codigo.toUpperCase() === form.cproducto.toUpperCase());
  const monedaFuera = form.cmoneda && !monedas.some((m) => m.codigo.toUpperCase() === form.cmoneda.toUpperCase());

  return (
    <SectionPanel title="Datos del plan" description="Nombre, moneda, producto y estado de la versión vigente del plan." icon={FileText}>
      <div className="space-y-4 text-xs">
        <AlertaError error={error} />
        {ok && <Alert variant={hayCambios ? 'info' : 'success'}>{ok}</Alert>}
        {avisos.length > 0 && (
          <Alert variant="warning">
            <ul className="list-disc space-y-0.5 pl-4">
              {avisos.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </Alert>
        )}
        {!plan && <p className="text-slate-500">Leyendo el plan…</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="cab-xplan" className="inline-flex items-center gap-1">
              Nombre del plan
              <InfoTip text="xplan." />
            </Label>
            <Input
              id="cab-xplan"
              value={form.xplan}
              maxLength={60}
              disabled={soloLectura || !plan}
              className={cn(errores.xplan && 'border-red-300')}
              onChange={(e) => setForm({ ...form, xplan: e.target.value })}
            />
            {errores.xplan && <p className="mt-0.5 text-[11px] text-red-700">{errores.xplan}</p>}
          </div>
          <div>
            <Label htmlFor="cab-moneda" className="inline-flex items-center gap-1">
              Moneda
              <InfoTip text="cmoneda; se valida contra las monedas de Sis2000 (mamonedas)." />
            </Label>
            <select
              id="cab-moneda"
              className={cn(SELECT, errores.cmoneda && 'border-red-300')}
              disabled={soloLectura || !plan}
              value={form.cmoneda}
              onChange={(e) => setForm({ ...form, cmoneda: e.target.value })}
            >
              <option value="">Elegir…</option>
              {monedaFuera && <option value={form.cmoneda}>{form.cmoneda}</option>}
              {monedas.map((m) => (
                <option key={m.codigo} value={m.codigo}>
                  {m.codigo}
                  {m.nombre ? ` · ${m.nombre}` : ''}
                </option>
              ))}
            </select>
            {errores.cmoneda && <p className="mt-0.5 text-[11px] text-red-700">{errores.cmoneda}</p>}
          </div>
          <div>
            <Label htmlFor="cab-producto" className="inline-flex items-center gap-1">
              Producto
              <InfoTip text={`Productos del ramo ${cramo} con código de 6 caracteres o menos (cproducto).`} />
            </Label>
            <select
              id="cab-producto"
              className={cn(SELECT, errores.cproducto && 'border-red-300')}
              disabled={soloLectura || !plan}
              value={form.cproducto}
              onChange={(e) => setForm({ ...form, cproducto: e.target.value })}
            >
              <option value="">Elegir…</option>
              {productoFuera && <option value={form.cproducto}>{form.cproducto}</option>}
              {productos.map((p) => (
                <option key={p.codigo} value={p.codigo}>
                  {p.codigo}
                  {p.nombre ? ` · ${p.nombre}` : ''}
                </option>
              ))}
            </select>
            {errores.cproducto && <p className="mt-0.5 text-[11px] text-red-700">{errores.cproducto}</p>}
          </div>
          <div>
            <Label htmlFor="cab-estado" className="inline-flex items-center gap-1">
              Estado
              <InfoTip text="iestado: V = activo, I = inactivo." />
            </Label>
            <select
              id="cab-estado"
              className={SELECT}
              disabled={soloLectura || !plan}
              value={form.iestado}
              onChange={(e) => setForm({ ...form, iestado: e.target.value })}
            >
              <option value="V">Activo (se ofrece)</option>
              <option value="I">Inactivo (no se ofrece)</option>
            </select>
          </div>
        </div>

        {!soloLectura && plan && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <Label htmlFor="cab-motivo">Motivo (opcional, queda en el historial)</Label>
              <Input id="cab-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>
            <Button type="button" size="sm" onClick={intentarGuardar} disabled={guardando}>
              <Save className="h-3.5 w-3.5" />
              Guardar datos del plan
            </Button>
          </div>
        )}

        {confirmarInactivar && (
          <ConfirmarDialog
            titulo="Inactivar el plan"
            confirmar="Inactivar"
            cancelar="No inactivar"
            ocupado={guardando}
            onConfirmar={() => void guardar(false)}
            onCancelar={() => setConfirmarInactivar(false)}
          >
            <p>
              El plan deja de ofrecerse: ya no se podrá cotizar ni emitir con él. Las pólizas emitidas no cambian. Puedes volver a
              activarlo después.
            </p>
          </ConfirmarDialog>
        )}

        {porConfirmar && (
          <ConfirmarDialog
            titulo="Revisa antes de guardar"
            confirmar="Guardar de todas formas"
            cancelar="No guardar"
            ocupado={guardando}
            onConfirmar={() => void guardar(true)}
            onCancelar={() => setPorConfirmar(null)}
          >
            <p>Sis2000 avisa lo siguiente:</p>
            <ul className="list-disc space-y-1 pl-5">
              {porConfirmar.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </ConfirmarDialog>
        )}
      </div>
    </SectionPanel>
  );
}
