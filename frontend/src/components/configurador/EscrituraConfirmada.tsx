import { useRef, useState } from 'react';
import { advertenciasPorConfirmar } from '@/lib/configurador';
import { esNoImplementado } from '@/lib/configurador-fase2';
import { entenderError, type ErrorEntendible } from '@/lib/errores';
import { ConfirmarDialog } from '@/components/sis2000/AsistentePasos';
import { Alert } from '@/components/ui/alert';
import { AlertaError } from '@/components/ui/errores';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Escritura de los paneles de la fase 2 con el mismo patrón de la fase 1: error traducido, mensaje de éxito,
// advertencias informativas, advertencias que piden confirmar (se reenvía con confirmar: true) y 501 = «todavía no
// está disponible en Sis2000». Lo usan CoberturasPlanPanel, EdadesParentescoPanel, CondominioPanel, TarifaDiasPanel y
// TasaCascoPanel.

export interface OpcionesEscritura {
  /** Mensaje de éxito. */
  ok: string;
  /** Encabezado del error («No se pudo …»). */
  titulo: string;
  /** Mensaje propio para 409. */
  duplicado?: string;
  /** Mensaje si nest-api responde 501 (la operación no existe todavía en Sis2000). */
  noImplementado?: string;
  /** Tras grabar (con la respuesta). */
  alTerminar?: (respuesta: unknown) => void;
}

const NO_DISPONIBLE = 'Esta operación todavía no está disponible en Sis2000. Avísale a Técnica.';

export function useEscritura() {
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<ErrorEntendible | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [noDisponible, setNoDisponible] = useState<string | null>(null);
  const [porConfirmar, setPorConfirmar] = useState<{ advertencias: string[]; confirmar: () => void } | null>(null);
  const ocupado = useRef(false);

  function limpiar() {
    setError(null);
    setOk(null);
    setAvisos([]);
    setNoDisponible(null);
  }

  /** `op(confirmar)` hace la llamada; con confirmar = true el cuerpo debe llevar `confirmar: true`. */
  async function ejecutar(op: (confirmar: boolean) => Promise<unknown>, opciones: OpcionesEscritura, confirmar = false): Promise<boolean> {
    if (ocupado.current) return false;
    ocupado.current = true;
    setTrabajando(true);
    limpiar();
    try {
      const r = await op(confirmar);
      const adv = advertenciasPorConfirmar(r, confirmar);
      if (adv.length) {
        setPorConfirmar({ advertencias: adv, confirmar: () => void ejecutar(op, opciones, true) });
        return false;
      }
      setPorConfirmar(null);
      const info = r && typeof r === 'object' && Array.isArray((r as { advertencias?: unknown }).advertencias)
        ? ((r as { advertencias: unknown[] }).advertencias.map(String).filter(Boolean))
        : [];
      setAvisos(info);
      setOk(opciones.ok);
      opciones.alTerminar?.(r);
      return true;
    } catch (e) {
      const adv = advertenciasPorConfirmar(e, confirmar);
      if (adv.length) {
        setPorConfirmar({ advertencias: adv, confirmar: () => void ejecutar(op, opciones, true) });
        return false;
      }
      setPorConfirmar(null);
      if (esNoImplementado(e)) setNoDisponible(opciones.noImplementado ?? NO_DISPONIBLE);
      else setError(entenderError(e, { titulo: opciones.titulo, duplicado: opciones.duplicado }));
      return false;
    } finally {
      ocupado.current = false;
      setTrabajando(false);
    }
  }

  return { trabajando, error, setError, ok, setOk, avisos, noDisponible, setNoDisponible, porConfirmar, setPorConfirmar, ejecutar, limpiar };
}

export type Escritura = ReturnType<typeof useEscritura>;

/** Error, éxito, avisos y «no disponible» de la última escritura. */
export function EstadoEscritura({ esc, onReintentar }: { esc: Escritura; onReintentar?: () => void }) {
  return (
    <>
      <AlertaError error={esc.error} onReintentar={onReintentar} />
      {esc.noDisponible && <Alert variant="info">{esc.noDisponible}</Alert>}
      {esc.ok && <Alert variant="success">{esc.ok}</Alert>}
      {esc.avisos.length > 0 && (
        <Alert variant="warning">
          <ul className="list-disc space-y-0.5 pl-4">
            {esc.avisos.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </Alert>
      )}
    </>
  );
}

/** Diálogo «Revisa antes de guardar» con las advertencias de Sis2000; «Guardar de todas formas» reenvía con confirmar. */
export function DialogoConfirmarEscritura({ esc, contexto }: { esc: Escritura; contexto?: string }) {
  if (!esc.porConfirmar) return null;
  const { advertencias, confirmar } = esc.porConfirmar;
  return (
    <ConfirmarDialog
      titulo="Revisa antes de guardar"
      confirmar="Guardar de todas formas"
      cancelar="No guardar"
      ocupado={esc.trabajando}
      onConfirmar={confirmar}
      onCancelar={() => esc.setPorConfirmar(null)}
    >
      <p>{contexto ?? 'Sis2000 avisa lo siguiente:'}</p>
      <ul className="list-disc space-y-1 pl-5">
        {advertencias.map((a, i) => (
          <li key={i}>{a}</li>
        ))}
      </ul>
    </ConfirmarDialog>
  );
}

/** Motivo opcional del cambio (queda en el historial del configurador). */
export function CampoMotivo({ id, valor, onChange, disabled }: { id: string; valor: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="min-w-[240px] flex-1">
      <Label htmlFor={id}>Motivo (opcional, queda en el historial)</Label>
      <Input id={id} value={valor} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
