import { InfoTip } from '@/components/ui/info-tip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DeducibleForm, TipoDeducible } from '@/lib/configurador';
import { cn } from '@/lib/utils';

// Campos del deducible (tipo, monto en Bs, monto en divisa y %). Se reutilizan al crear una tarifa, al editar una tasa
// y en la copia del plan.

export function DeducibleCampos({
  idBase,
  valor,
  onChange,
  errores = {},
  moneda = '$',
  deshabilitado,
  className,
}: {
  idBase: string;
  valor: DeducibleForm;
  onChange: (v: DeducibleForm) => void;
  errores?: Partial<Record<keyof DeducibleForm, string>>;
  moneda?: string;
  deshabilitado?: boolean;
  className?: string;
}) {
  const campo = (k: Exclude<keyof DeducibleForm, 'bfraded'>, etiqueta: string, ayuda: string) => (
    <div>
      <Label htmlFor={`${idBase}-${k}`} className="inline-flex items-center gap-1">
        {etiqueta}
        <InfoTip text={ayuda} />
      </Label>
      <Input
        id={`${idBase}-${k}`}
        inputMode="decimal"
        value={valor[k]}
        disabled={deshabilitado || !valor.bfraded}
        aria-invalid={Boolean(errores[k])}
        className={cn(errores[k] && 'border-red-300')}
        onChange={(e) => onChange({ ...valor, [k]: e.target.value })}
      />
      {errores[k] && <p className="mt-0.5 text-[11px] text-red-700">{errores[k]}</p>}
    </div>
  );
  return (
    <div className={cn('grid gap-3 sm:grid-cols-4', className)}>
      <div>
        <Label htmlFor={`${idBase}-bfraded`} className="inline-flex items-center gap-1">
          Deducible
          <InfoTip text="Deducible: el asegurado paga ese monto o porcentaje de cada siniestro. Franquicia: si el daño no supera el monto no se paga; si lo supera, se paga completo. (Sis2000: bfraded D / F)" />
        </Label>
        <select
          id={`${idBase}-bfraded`}
          className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
          value={valor.bfraded}
          disabled={deshabilitado}
          onChange={(e) => onChange({ ...valor, bfraded: e.target.value as TipoDeducible })}
        >
          <option value="">Sin deducible</option>
          <option value="D">Deducible</option>
          <option value="F">Franquicia</option>
        </select>
      </div>
      {campo('mdedu_fran', 'Monto (Bs)', 'Monto fijo del deducible en bolívares (Sis2000: mdedu_fran).')}
      {campo('mdedu_franext', `Monto (${moneda})`, 'Monto fijo del deducible en divisa (Sis2000: mdedu_franext).')}
      {campo('pdedu_fran', 'Porcentaje %', 'Porcentaje del siniestro o de la suma asegurada, entre 0 y 100 (Sis2000: pdedu_fran).')}
    </div>
  );
}
