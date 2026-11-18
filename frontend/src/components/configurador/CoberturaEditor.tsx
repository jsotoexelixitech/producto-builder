import { useState } from 'react';
import { api } from '@/lib/api';
import {
  cambiosCobertura,
  coberturaEditable,
  cuerpoCambiosCobertura,
  validarCoberturaEditable,
  type CoberturaEditable,
  type CambioCobertura,
} from '@/lib/cobertura-ficha';
import { normalizeCatalogUpdatePayload } from '@/lib/sis2000-nest-api';
import { entenderError, type ErrorEntendible } from '@/lib/errores';
import { ConfirmarDialog } from '@/components/sis2000/AsistentePasos';
import { AlertaError } from '@/components/ui/errores';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { CampoMotivo } from './EscrituraConfirmada';

type Fila = Record<string, unknown>;

/**
 * Formulario para editar los datos de una cobertura del ramo (macoberturas) con confirmación: manda solo lo que
 * cambió al mismo PUT que «Editar cobertura» (/core/sis2000/coberturas/:cramo/:ccobertura), que deja la copia
 * anterior en el historial. Moneda y equivalencia interna no se cambian al editar (nest-api no las acepta).
 */
export function CoberturaEditor({
  cramo,
  fila,
  onGuardado,
  onCancelar,
  onError,
}: {
  cramo: number;
  fila: Fila;
  onGuardado: () => void;
  onCancelar: () => void;
  /** Error ya traducido (p. ej. para dejar el panel en lectura si la escritura está apagada). */
  onError?: (e: ErrorEntendible) => void;
}) {
  const ccobertura = String(fila.ccobertura ?? '').trim();
  const [original] = useState<CoberturaEditable>(() => coberturaEditable(fila));
  const [form, setForm] = useState<CoberturaEditable>(original);
  const [motivo, setMotivo] = useState('');
  const [intento, setIntento] = useState(false);
  const [porConfirmar, setPorConfirmar] = useState<CambioCobertura[] | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<ErrorEntendible | null>(null);

  const errores = intento ? validarCoberturaEditable(form) : {};
  const cambiar = <K extends keyof CoberturaEditable>(k: K, v: CoberturaEditable[K]) => setForm((f) => ({ ...f, [k]: v }));
  const id = (k: string) => `cob-ed-${ccobertura}-${k}`;

  function revisar() {
    setIntento(true);
    setError(null);
    if (Object.keys(validarCoberturaEditable(form)).length) return;
    const cambios = cambiosCobertura(original, form);
    if (!cambios.length) {
      onCancelar();
      return;
    }
    setPorConfirmar(cambios);
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const cuerpo = normalizeCatalogUpdatePayload({ cramo, ccobertura, ...cuerpoCambiosCobertura(original, form) });
      await api.updateSis2000Cobertura(cramo, ccobertura, { ...cuerpo, motivoCambio: motivo.trim() || undefined });
      setPorConfirmar(null);
      onGuardado();
    } catch (e) {
      const entendido = entenderError(e, { que: 'una cobertura', titulo: 'No se pudo guardar la cobertura' });
      setPorConfirmar(null);
      setError(entendido);
      onError?.(entendido);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/30 p-3 text-xs">
      <p className="font-semibold text-slate-800">Editar la cobertura</p>
      <AlertaError error={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Nombre *" htmlFor={id('xl')} error={errores.xdescripcion_l} span={2} tooltip={'Nombre de la cobertura como sale en la cotización, la póliza y SysIP. Máximo 60 caracteres. Ejemplo: DAÑOS A COSAS.\nEn Sis2000: macoberturas.xdescripcion_l'}>
          <Input id={id('xl')} value={form.xdescripcion_l} onChange={(e) => cambiar('xdescripcion_l', e.target.value)} />
        </FormField>
        <FormField label="Nombre corto" htmlFor={id('xc')} error={errores.xdescripcion_c} tooltip={'Nombre corto para listados y reportes (hasta 15 caracteres).\nEn Sis2000: macoberturas.xdescripcion_c'}>
          <Input id={id('xc')} value={form.xdescripcion_c} onChange={(e) => cambiar('xdescripcion_c', e.target.value)} />
        </FormField>
        <FormField label="Abreviatura" htmlFor={id('xab')} error={errores.xabreviatura} tooltip={'Abreviatura de la cobertura para listados y reportes.\nEn Sis2000: macoberturas.xabreviatura'}>
          <Input id={id('xab')} value={form.xabreviatura} onChange={(e) => cambiar('xabreviatura', e.target.value)} />
        </FormField>
        <FormField
          label="Contrato de reaseguro"
          htmlFor={id('ccontrea')}
          error={errores.ccontrea}
          hint="Vacío = sin contrato; la revisión del plan lo marca como pendiente."
          tooltip={'Contrato de reaseguro al que se cede esta cobertura al emitir. Lo debe indicar Reaseguro; sin contrato la revisión del plan avisa que falta.\nEn Sis2000: macoberturas.ccontrea'}
        >
          <Input id={id('ccontrea')} inputMode="numeric" value={form.ccontrea} onChange={(e) => cambiar('ccontrea', e.target.value)} />
        </FormField>
        <FormField label="Ramo de reaseguro" htmlFor={id('cramorea')} error={errores.cramorea} tooltip={'Ramo de reaseguro del contrato; va junto con el contrato.\nEn Sis2000: macoberturas.cramorea'}>
          <Input id={id('cramorea')} inputMode="numeric" value={form.cramorea} onChange={(e) => cambiar('cramorea', e.target.value)} />
        </FormField>
        <FormField
          label="Estado"
          htmlFor={id('estado')}
          hint={!form.activa ? 'Inactiva: ya no se puede agregar a planes; los planes que ya la tienen no cambian.' : undefined}
          tooltip={'Activa: se puede agregar a planes. Inactiva: deja de ofrecerse para planes nuevos; los que ya la tienen no cambian. Es del ramo: vale para todos sus planes.\nEn Sis2000: macoberturas.iestado (V = activa, I = inactiva)'}
        >
          <select
            id={id('estado')}
            className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
            value={form.activa ? 'V' : 'I'}
            onChange={(e) => cambiar('activa', e.target.value === 'V')}
          >
            <option value="V">Activa</option>
            <option value="I">Inactiva</option>
          </select>
        </FormField>
      </div>
      <p className="text-[11px] text-muted-foreground">
        La moneda y la equivalencia interna no se cambian desde aquí. Que sea obligatoria u opcional lo define su tarifa.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <CampoMotivo id={id('motivo')} valor={motivo} onChange={setMotivo} disabled={guardando} />
        <Button type="button" size="sm" variant="outline" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="button" size="sm" onClick={revisar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar cobertura'}
        </Button>
      </div>
      {porConfirmar && (
        <ConfirmarDialog
          titulo="¿Guardar la cobertura?"
          confirmar="Sí, guardar"
          ocupado={guardando}
          onConfirmar={() => void guardar()}
          onCancelar={() => setPorConfirmar(null)}
        >
          <p>
            Cambia en el ramo {cramo} para todos los productos que la usan. Lo anterior queda en el historial y se puede
            restaurar.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {porConfirmar.map((c) => (
              <li key={c.campo}>
                {c.etiqueta}: {c.antes} → <strong>{c.despues}</strong>
              </li>
            ))}
          </ul>
        </ConfirmarDialog>
      )}
    </div>
  );
}
