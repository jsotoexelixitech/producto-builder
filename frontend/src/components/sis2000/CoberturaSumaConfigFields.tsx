import { UNIDAD_CALCULO_DEFAULT, type TipoSumaAsegurada } from '@/lib/sis2000-nest-api';
import { FormField, FormGrid } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

const ETIQUETA_OPCION =
  'inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-xs font-medium';

export interface SumaConfigValores {
  tipoSuma: TipoSumaAsegurada;
  unidadCalculo: string;
  etiquetaCuadro: string;
}

interface Props {
  valores: SumaConfigValores;
  errores?: { unidadCalculo?: string; etiquetaCuadro?: string };
  disabled?: boolean;
  /** Prefijo de ids para que no choquen si hay dos formularios en pantalla. */
  idPrefix?: string;
  onChange: (cambios: Partial<SumaConfigValores>) => void;
}

/**
 * «Suma calculada al emitir»: la suma asegurada = unidades × valor por unidad y ambos llegan al emitir.
 * Genérico para cualquier producto; se guarda en el configurador (no en Sis2000).
 */
export function CoberturaSumaConfigFields({
  valores,
  errores = {},
  disabled,
  idPrefix = 'sc',
  onChange,
}: Props) {
  const calculada = valores.tipoSuma === 'CALCULADA';
  return (
    <div className="space-y-3">
      <label className={ETIQUETA_OPCION}>
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          checked={calculada}
          disabled={disabled}
          onChange={(e) => onChange({ tipoSuma: e.target.checked ? 'CALCULADA' : 'FIJA' })}
        />
        Suma calculada al emitir
      </label>
      <p className="text-xs text-muted-foreground">
        La suma asegurada no es fija: al emitir se indican las unidades y el valor por unidad y el sistema
        la calcula (unidades × valor por unidad). En los planes esta cobertura no pide suma ni tasa/prima.
      </p>
      {calculada && (
        <FormGrid>
          <FormField
            label="Unidad de cálculo (nombre en el sistema)"
            htmlFor={`${idPrefix}-unidad`}
            hint={`Opcional. Si lo dejas vacío se usa «${UNIDAD_CALCULO_DEFAULT}».`}
            tooltip="Nombre genérico con el que el sistema trata la unidad. No sale en la póliza."
            error={errores.unidadCalculo}
          >
            <Input
              id={`${idPrefix}-unidad`}
              value={valores.unidadCalculo}
              maxLength={60}
              disabled={disabled}
              placeholder={UNIDAD_CALCULO_DEFAULT}
              onChange={(e) => onChange({ unidadCalculo: e.target.value })}
            />
          </FormField>
          <FormField
            label="Etiqueta en el cuadro póliza *"
            htmlFor={`${idPrefix}-etiqueta`}
            tooltip="Palabra que ve el asegurado en el cuadro póliza junto a las unidades."
            error={errores.etiquetaCuadro}
          >
            <Input
              id={`${idPrefix}-etiqueta`}
              value={valores.etiquetaCuadro}
              maxLength={40}
              disabled={disabled}
              placeholder="Ej.: Kilo, Hectárea"
              onChange={(e) => onChange({ etiquetaCuadro: e.target.value })}
            />
          </FormField>
        </FormGrid>
      )}
    </div>
  );
}
