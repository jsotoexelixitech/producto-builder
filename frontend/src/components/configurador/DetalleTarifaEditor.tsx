import { useState } from 'react';
import { api } from '@/lib/api';
import {
  cuerpoDeducible,
  deducibleDeFila,
  fechaIso,
  validarDeducible,
  type DeducibleForm,
} from '@/lib/configurador';
import { entenderError, type ErrorEntendible } from '@/lib/errores';
import { AlertaError } from '@/components/ui/errores';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DeducibleCampos } from './DeducibleCampos';

type Fila = Record<string, unknown>;
const aTexto = (v: unknown) => (v == null || v === '' ? '' : String(v).trim());
const MONTOS = [
  { clave: 'msumamin', titulo: 'Suma mínima' },
  { clave: 'msumamax', titulo: 'Suma máxima' },
  { clave: 'mprima', titulo: 'Prima fija' },
  { clave: 'pprima', titulo: 'Tasa %' },
] as const;

/**
 * Edita una tasa con vigencia de una tarifa (matarifa_d): montos, deducible, cerrar la vigencia (fecha hasta) o
 * inactivarla. Solo puede haber una tasa vigente por tarifa: reactivar otra da «ya existe» (409).
 */
export function DetalleTarifaEditor({
  cramo,
  ccober,
  ctarifa,
  detalle,
  onGuardado,
  onCancelar,
}: {
  cramo: number;
  ccober: string;
  ctarifa: string;
  detalle: Fila;
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const fdesde = fechaIso(detalle.fdesde);
  const [montos, setMontos] = useState<Record<string, string>>(() => Object.fromEntries(MONTOS.map((m) => [m.clave, aTexto(detalle[m.clave])])));
  const [fhasta, setFhasta] = useState(detalle.fhasta ? fechaIso(detalle.fhasta) : '');
  const [iestado, setIestado] = useState(aTexto(detalle.iestado).toUpperCase() === 'I' ? 'I' : 'V');
  const [deducible, setDeducible] = useState<DeducibleForm>(deducibleDeFila(detalle));
  const [motivo, setMotivo] = useState('');
  const [intento, setIntento] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<ErrorEntendible | null>(null);

  const original = deducibleDeFila(detalle);
  const cambioDeducible = JSON.stringify(original) !== JSON.stringify(deducible);
  const erroresDed = intento ? validarDeducible(deducible) : {};

  async function guardar() {
    setIntento(true);
    if (Object.keys(validarDeducible(deducible)).length) return;
    const cuerpo: Record<string, unknown> = { motivoCambio: motivo || undefined };
    for (const m of MONTOS) {
      const v = montos[m.clave].trim().replace(',', '.');
      if (v !== aTexto(detalle[m.clave]) && v !== '') {
        if (!Number.isFinite(Number(v)) || Number(v) < 0) {
          setError(entenderError(new Error(`${m.titulo}: debe ser un número de 0 o más.`)));
          return;
        }
        cuerpo[m.clave] = Number(v);
      }
    }
    if (fhasta && fhasta < fdesde) {
      setError(entenderError(new Error(`La fecha hasta no puede ser anterior a la fecha desde (${fdesde}).`)));
      return;
    }
    if (fhasta && fhasta !== (detalle.fhasta ? fechaIso(detalle.fhasta) : '')) cuerpo.fhasta = fhasta;
    if (iestado !== (aTexto(detalle.iestado).toUpperCase() || 'V')) cuerpo.iestado = iestado;
    // El deducible solo se manda si cambió: escribirlo exige la bandera de deducibles en nest-api.
    if (cambioDeducible) Object.assign(cuerpo, cuerpoDeducible(deducible, true));
    if (Object.keys(cuerpo).length === 1) {
      onCancelar();
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await api.editarSis2000DetalleTarifa(cramo, ccober, ctarifa, fdesde, cuerpo);
      onGuardado();
    } catch (e) {
      setError(
        entenderError(e, {
          titulo: 'No se pudo guardar la tasa',
          duplicado: 'La tarifa ya tiene otra tasa vigente. Cierra o inactiva esa antes de reactivar esta.',
        }),
      );
    } finally {
      setGuardando(false);
    }
  }

  const id = `det-${ccober}-${ctarifa}-${fdesde}`;
  return (
    <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/30 p-3 text-xs">
      <p className="font-semibold text-slate-800">Editar la tasa vigente desde {fdesde}</p>
      <AlertaError error={error} />
      <div className="grid gap-3 sm:grid-cols-4">
        {MONTOS.map((m) => (
          <div key={m.clave}>
            <Label htmlFor={`${id}-${m.clave}`}>{m.titulo}</Label>
            <Input
              id={`${id}-${m.clave}`}
              inputMode="decimal"
              value={montos[m.clave]}
              onChange={(e) => setMontos({ ...montos, [m.clave]: e.target.value })}
            />
          </div>
        ))}
        <div>
          <Label htmlFor={`${id}-fhasta`}>Vigente hasta</Label>
          <Input id={`${id}-fhasta`} type="date" value={fhasta} onChange={(e) => setFhasta(e.target.value)} />
        </div>
        <div>
          <Label htmlFor={`${id}-iestado`}>Estado</Label>
          <select
            id={`${id}-iestado`}
            className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
            value={iestado}
            onChange={(e) => setIestado(e.target.value)}
          >
            <option value="V">Vigente</option>
            <option value="I">Inactiva</option>
          </select>
        </div>
      </div>
      <DeducibleCampos idBase={`${id}-ded`} valor={deducible} onChange={setDeducible} errores={erroresDed} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <Label htmlFor={`${id}-motivo`}>Motivo (opcional, queda en el historial)</Label>
          <Input id={`${id}-motivo`} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="button" size="sm" onClick={() => void guardar()} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar tasa'}
        </Button>
      </div>
    </div>
  );
}
