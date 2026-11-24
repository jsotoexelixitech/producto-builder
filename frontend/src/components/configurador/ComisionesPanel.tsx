import { useCallback, useEffect, useMemo, useState } from 'react';
import { Percent, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import {
  comodin,
  comodinesRamoQueCubren,
  cuerpoComision,
  normalizarComision,
  validarComision,
  type CoberturaDelPlan,
  type Comision,
  type ComisionForm,
} from '@/lib/configurador';
import { entenderError, type ErrorEntendible } from '@/lib/errores';
import { Alert } from '@/components/ui/alert';
import { AlertaError } from '@/components/ui/errores';
import { Button } from '@/components/ui/button';
import { InfoTip } from '@/components/ui/info-tip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionPanel } from '@/components/ui/section-panel';
import { cn } from '@/lib/utils';

const hoy = () => new Date().toISOString().slice(0, 10);
const FORM_VACIO = (): ComisionForm => ({ ctipoprod: '', cproductor: '', ccober: '', ctarifa: '', fdesde: hoy(), pcomision: '' });

/**
 * Comisiones del plan (todas las familias). Muestra también las del ramo que aplican a todos sus planes. Dar de baja
 * cierra la vigencia (no borra). Para cambiar un porcentaje: dar de baja la vigente y agregar la nueva.
 */
export function ComisionesPanel({
  planId,
  coberturas = [],
  onCambio,
}: {
  /** "cramo-cplan". */
  planId: string;
  coberturas?: CoberturaDelPlan[];
  onCambio?: () => void;
}) {
  const [filas, setFilas] = useState<Comision[] | null>(null);
  const [error, setError] = useState<ErrorEntendible | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  /** Advertencias informativas del alta (nest-api grabó igual). */
  const [avisos, setAvisos] = useState<string[]>([]);
  const [verBajas, setVerBajas] = useState(false);
  const [form, setForm] = useState<ComisionForm>(FORM_VACIO);
  const [intento, setIntento] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [baja, setBaja] = useState<{ fila: Comision; fhasta: string } | null>(null);

  const cargar = useCallback(() => {
    setError(null);
    api
      .listarSis2000Comisiones(planId)
      .then((r) => setFilas(r.map(normalizarComision)))
      .catch((e) => {
        setFilas([]);
        setError(entenderError(e, { titulo: 'No se pudieron leer las comisiones del plan' }));
      });
  }, [planId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const errores = intento ? validarComision(form) : {};
  const visibles = (filas ?? []).filter((f) => verBajas || f.iestado === 'V');
  /** Comisiones del ramo (comodín) que ya aplican a lo que se está por agregar. */
  const yaCubiertas = useMemo(() => comodinesRamoQueCubren(filas ?? [], form), [filas, form]);
  const vigentesPlan = useMemo(() => (filas ?? []).filter((f) => f.iestado === 'V' && f.aplicaA === 'plan').length, [filas]);

  async function ejecutar(accion: () => Promise<unknown>, mensaje: string, titulo: string): Promise<boolean> {
    setTrabajando(true);
    setError(null);
    setOk(null);
    setAvisos([]);
    try {
      await accion();
      setOk(mensaje);
      setMotivo('');
      cargar();
      onCambio?.();
      return true;
    } catch (e) {
      setError(
        entenderError(e, {
          titulo,
          duplicado:
            'Ya hay una comisión vigente para ese intermediario, productor, cobertura y tarifa. Dale de baja primero y vuelve a agregarla con el nuevo porcentaje.',
        }),
      );
      return false;
    } finally {
      setTrabajando(false);
    }
  }

  function agregar() {
    setIntento(true);
    if (Object.keys(validarComision(form)).length) return;
    const cuerpo = cuerpoComision(form);
    void ejecutar(
      async () => {
        const r = await api.agregarSis2000Comision(planId, { ...cuerpo, motivoCambio: motivo || undefined });
        if (Array.isArray(r?.advertencias)) setAvisos(r.advertencias.map(String));
      },
      `Comisión de ${cuerpo.pcomision} % agregada desde el ${cuerpo.fdesde}.`,
      'No se pudo agregar la comisión',
    ).then((g) => {
      if (!g) return;
      setForm(FORM_VACIO());
      setIntento(false);
    });
  }

  function confirmarBaja() {
    if (!baja) return;
    const { fila, fhasta } = baja;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fhasta) || fhasta < fila.fdesde) {
      setError(entenderError(new Error(`La fecha de baja debe ser el ${fila.fdesde} o posterior.`)));
      return;
    }
    void ejecutar(
      () =>
        api.bajaSis2000Comision(planId, {
          ctipoprod: fila.ctipoprod,
          cproductor: fila.cproductor,
          ccober: fila.ccober,
          ctarifa: fila.ctarifa,
          fdesde: fila.fdesde,
          fhasta,
          motivoCambio: motivo || undefined,
        }),
      `Comisión dada de baja desde el ${fhasta} (no se borra).`,
      'No se pudo dar de baja la comisión',
    ).then((g) => g && setBaja(null));
  }

  const campo = (k: keyof ComisionForm, etiqueta: string, ayuda: string, extra: { placeholder?: string; type?: string } = {}) => (
    <div>
      <Label htmlFor={`com-${k}`} className="inline-flex items-center gap-1">
        {etiqueta}
        <InfoTip text={ayuda} />
      </Label>
      <Input
        id={`com-${k}`}
        value={form[k]}
        aria-invalid={Boolean(errores[k])}
        className={cn(errores[k] && 'border-red-300')}
        onChange={(e) => setForm({ ...form, [k]: e.target.value })}
        {...extra}
      />
      {errores[k] && <p className="mt-0.5 text-[11px] text-red-700">{errores[k]}</p>}
    </div>
  );

  return (
    <SectionPanel
      title="Comisiones"
      description="Porcentaje de la prima que se paga al productor por cada póliza del plan. Si no hay comisión vigente que aplique, se emite con 0 %. «Todas» o «Todos» = cualquier cobertura, tarifa o productor."
      icon={Percent}
    >
      <div className="space-y-4 text-xs">
        <AlertaError error={error} onReintentar={cargar} />
        {ok && <Alert variant="success">{ok}</Alert>}
        {avisos.length > 0 && (
          <Alert variant="warning">
            <ul className="list-disc space-y-0.5 pl-4">
              {avisos.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </Alert>
        )}
        {filas && filas.length > 0 && vigentesPlan === 0 && (
          <Alert variant="info">El plan no tiene comisiones propias: usa las del ramo (las marcadas «Del ramo»).</Alert>
        )}

        {filas === null ? (
          <p className="text-slate-500">Leyendo comisiones…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[720px] text-left">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Aplica a</th>
                  <th className="px-3 py-2">Intermediario</th>
                  <th className="px-3 py-2">Productor</th>
                  <th className="px-3 py-2">Cobertura</th>
                  <th className="px-3 py-2">Tarifa</th>
                  <th className="px-3 py-2">Vigencia</th>
                  <th className="px-3 py-2 text-right">Comisión</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-center text-slate-500">
                      No hay comisiones {verBajas ? '' : 'vigentes '}para este plan ni para su ramo.
                    </td>
                  </tr>
                )}
                {visibles.map((f) => (
                  <tr key={`${f.aplicaA}-${f.ctipoprod}-${f.cproductor}-${f.ccober}-${f.ctarifa}-${f.fdesde}`} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          f.aplicaA === 'ramo' ? 'bg-slate-100 text-slate-700' : 'bg-indigo-50 text-indigo-800',
                        )}
                      >
                        {f.aplicaA === 'ramo' ? 'Del ramo' : 'Este plan'}
                      </span>
                    </td>
                    <td className="px-3 py-2">{f.ctipoprod}</td>
                    <td className="px-3 py-2">{comodin(f.cproductor, 'Todos')}</td>
                    <td className="px-3 py-2">{comodin(f.ccober)}</td>
                    <td className="px-3 py-2">{comodin(f.ctarifa)}</td>
                    <td className="px-3 py-2">
                      {f.fdesde}
                      {f.fhasta ? ` al ${f.fhasta}` : ' en adelante'}
                      {f.iestado !== 'V' && <span className="ml-1 text-slate-500">(de baja)</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">{f.pcomision == null ? '—' : `${f.pcomision.toLocaleString('es-VE')} %`}</td>
                    <td className="px-3 py-2 text-right">
                      {f.iestado === 'V' && f.aplicaA === 'plan' && (
                        <Button type="button" variant="ghost" size="sm" disabled={trabajando} onClick={() => setBaja({ fila: f, fhasta: hoy() < f.fdesde ? f.fdesde : hoy() })}>
                          Dar de baja
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <label className="inline-flex items-center gap-2 text-slate-600">
          <input type="checkbox" checked={verBajas} onChange={(e) => setVerBajas(e.target.checked)} />
          Ver también las dadas de baja
        </label>

        {baja && (
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="w-full font-semibold text-amber-900">
              Dar de baja la comisión de {baja.fila.pcomision ?? '—'} % (desde {baja.fila.fdesde}). La fila no se borra: queda con fecha de fin.
            </p>
            <div>
              <Label htmlFor="com-baja-fhasta">Último día de vigencia</Label>
              <Input id="com-baja-fhasta" type="date" value={baja.fhasta} onChange={(e) => setBaja({ ...baja, fhasta: e.target.value })} />
            </div>
            <Button type="button" size="sm" variant="destructive" onClick={confirmarBaja} disabled={trabajando}>
              Confirmar baja
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setBaja(null)} disabled={trabajando}>
              Cancelar
            </Button>
          </div>
        )}

        <div className="space-y-3 rounded-xl border border-dashed border-slate-200 p-3">
          <p className="font-semibold text-slate-800">Agregar comisión a este plan</p>
          {yaCubiertas.length > 0 && (
            <Alert variant="warning">
              El ramo ya tiene {yaCubiertas.length === 1 ? 'una comisión general vigente' : `${yaCubiertas.length} comisiones generales vigentes`}{' '}
              («Del ramo») que también aplica{yaCubiertas.length === 1 ? '' : 'n'} a esta combinación (
              {yaCubiertas.map((r) => `${r.pcomision ?? '—'} %`).join(', ')}). Si agregas esta, el plan quedaría con la comisión
              duplicada: revisa con Técnico antes de guardar.
            </Alert>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            {campo('ctipoprod', 'Tipo de intermediario', 'Tipo de intermediario al que aplica la comisión. Ejemplo: 1. Las comisiones generales del ramo usan 0 (cualquier tipo).\nEn Sis2000: maarancel.ctipoprod', { placeholder: '1' })}
            {campo('cproductor', 'Productor', 'Productor puntual que cobra este porcentaje. Vacío o 0 = todos los productores. Ejemplo: una comisión especial para un solo productor.\nEn Sis2000: maarancel.cproductor', { placeholder: 'Todos' })}
            <div>
              <Label htmlFor="com-ccober" className="inline-flex items-center gap-1">
                Cobertura
                <InfoTip text={'Cobertura a la que aplica el porcentaje. «Todas» = cualquier cobertura del plan. Evita dos comisiones vigentes para la misma cobertura: la emisión tomaría una sola y no se sabe cuál.\nEn Sis2000: maarancel.ccober (0 = todas)'} />
              </Label>
              <select
                id="com-ccober"
                className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={form.ccober}
                onChange={(e) => {
                  const c = coberturas.find((x) => x.ccobertura === e.target.value);
                  setForm({ ...form, ccober: e.target.value, ctarifa: c ? c.ctarifa : '' });
                }}
              >
                <option value="">Todas</option>
                {coberturas.map((c) => (
                  <option key={`${c.ccobertura}|${c.ctarifa}`} value={c.ccobertura}>
                    {c.ccobertura} · {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            {campo('ctarifa', 'Tarifa', 'Tarifa a la que aplica el porcentaje. Vacío = todas las tarifas.\nEn Sis2000: maarancel.ctarifa (0 = todas)', { placeholder: 'Todas' })}
            {campo('fdesde', 'Desde', 'Fecha desde la que rige la comisión. La emisión no mira fechas, solo que esté vigente: para cambiar un porcentaje, da de baja la actual y agrega la nueva.\nEn Sis2000: maarancel.fdesde', { type: 'date' })}
            {campo('pcomision', 'Comisión %', 'Porcentaje de la prima para el productor, entre 0 y 100 con hasta 2 decimales. Ejemplo: 10 = 10 % de la prima.\nEn Sis2000: maarancel.pcomision', { placeholder: '10' })}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <Label htmlFor="com-motivo">Motivo (opcional, queda en el historial)</Label>
              <Input id="com-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>
            <Button type="button" size="sm" onClick={agregar} disabled={trabajando}>
              <Plus className="h-3.5 w-3.5" />
              Agregar comisión
            </Button>
          </div>
        </div>
      </div>
    </SectionPanel>
  );
}
