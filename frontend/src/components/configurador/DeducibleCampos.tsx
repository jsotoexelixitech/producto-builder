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
          <InfoTip text={'Deducible: el asegurado asume ese monto o porcentaje en cada siniestro. Franquicia: si el daño no supera el monto no se paga; si lo supera, se paga completo. Ejemplo: deducible de 100 $ en un daño de 1.000 $ → se indemnizan 900 $.\nEn Sis2000: bfraded (D = deducible, F = franquicia)'} />
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
      {campo('mdedu_fran', 'Monto (Bs)', 'Monto fijo del deducible o franquicia en bolívares.\nEn Sis2000: mdedu_fran')}
      {campo('mdedu_franext', `Monto (${moneda})`, 'Monto fijo del deducible o franquicia en la moneda del plan. Ejemplo: 100.\nEn Sis2000: mdedu_franext')}
      {campo('pdedu_fran', 'Porcentaje %', 'Deducible como porcentaje, entre 0 y 100. Ejemplo: 10 = el asegurado asume el 10 %.\nEn Sis2000: pdedu_fran')}
    </div>
  );
}
