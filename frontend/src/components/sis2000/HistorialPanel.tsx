import { useCallback, useEffect, useState } from 'react';
import { History, RotateCcw, Undo2 } from 'lucide-react';
import { api } from '@/lib/api';
import {
  fechaHora,
  quienHizo,
  RESULTADO_LABEL,
  TIPO_VERSION_LABEL,
  valorCorto,
  type EntidadHistorial,
  type HistorialRespuesta,
  type MomentoVersion,
  type VersionHistorial,
  type VistaPreviaRestauracion,
} from '@/lib/sis2000-historial';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionPanel } from '@/components/ui/section-panel';
import { cn } from '@/lib/utils';

interface Props {
  entidad: EntidadHistorial;
  clave: string;
  /** Cambiar este número vuelve a cargar el historial (p. ej. después de guardar). */
  recargar?: number;
  /** Se llama después de restaurar, para que la pantalla recargue los datos de Sis2000. */
  onRestaurado?: () => void;
  titulo?: string;
  className?: string;
}

interface Pendiente {
  destino: string;
  momento: MomentoVersion;
  titulo: string;
}

const MAX_CAMBIOS = 8;

/**
 * Historial de lo que el configurador escribió en Sis2000: copia original (nunca se sobreescribe), cada versión con
 * quién, cuándo, qué cambió y motivo, y «Restaurar» (pide confirmación y motivo; la restauración queda como versión).
 */
export function HistorialPanel({ entidad, clave, recargar = 0, onRestaurado, titulo = 'Historial', className }: Props) {
  const [datos, setDatos] = useState<HistorialRespuesta | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'success' | 'warning'; texto: string; advertencias: string[] } | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [vista, setVista] = useState<VistaPreviaRestauracion | null>(null);
  const [verDatos, setVerDatos] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [restaurando, setRestaurando] = useState(false);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

  const cargar = useCallback(() => {
    if (!clave) return;
    setCargando(true);
    setError(null);
    api
      .getSis2000Historial(entidad, clave)
      .then(setDatos)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar el historial'))
      .finally(() => setCargando(false));
  }, [entidad, clave]);

  useEffect(() => {
    cargar();
  }, [cargar, recargar]);

  async function pedirRestauracion(p: Pendiente) {
    setPendiente(p);
    setVista(null);
    setVerDatos(false);
    setMotivo('');
    setAviso(null);
    setError(null);
    try {
      setVista(await api.vistaPreviaRestauracion(entidad, clave, p.destino, p.momento));
    } catch (e) {
      setPendiente(null);
      setError(e instanceof Error ? e.message : 'No se pudo preparar la restauración');
    }
  }

  async function confirmar() {
    if (!pendiente || motivo.trim().length < 5) return;
    setRestaurando(true);
    setError(null);
    try {
      const r = await api.restaurarSis2000(entidad, clave, {
        destino: pendiente.destino,
        momento: pendiente.momento,
        motivo: motivo.trim(),
      });
      setAviso({
        tipo: r.advertencias.length ? 'warning' : 'success',
        texto: `Se restauró ${r.restaurado} en Sis2000 (versión ${r.version.numero}).`,
        advertencias: r.advertencias,
      });
      setPendiente(null);
      setVista(null);
      cargar();
      onRestaurado?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo restaurar');
      cargar();
    } finally {
      setRestaurando(false);
    }
  }

  const respaldo = datos?.respaldo ?? null;
  const versiones = datos?.versiones ?? [];
  const hayOriginal = Boolean(respaldo && (respaldo.existia || versiones.some((v) => v.tipo === 'CREACION' && v.resultado === 'APLICADA')));

  function alternar(id: string) {
    setExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <SectionPanel
      title={titulo}
      description="Antes de cada cambio en Sis2000 se guarda una copia de lo que había. La copia original no se sobreescribe."
      icon={History}
      className={cn('mt-6', className)}
    >
      <div className="space-y-3">
        {error && <Alert variant="error">{error}</Alert>}
        {aviso && (
          <Alert variant={aviso.tipo}>
            {aviso.texto}
            {aviso.advertencias.length > 0 && (
              <ul className="mt-1 list-disc pl-4">
                {aviso.advertencias.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}

        {cargando && !datos && <div className="h-16 animate-pulse rounded-lg bg-muted/60" />}

        {datos && !respaldo && (
          <p className="text-xs text-muted-foreground">
            Todavía no hay cambios hechos desde el configurador. La copia original se guarda sola antes del primer cambio.
          </p>
        )}

        {respaldo && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="text-xs">
              {respaldo.existia ? (
                <>
                  <strong>Copia original</strong> guardada el {fechaHora(respaldo.createdAt)} por {quienHizo(respaldo)}.
                </>
              ) : (
                <>
                  <strong>Lo creó el configurador</strong> el {fechaHora(respaldo.createdAt)} ({quienHizo(respaldo)}). La
                  original es la versión de creación.
                </>
              )}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hayOriginal || restaurando}
              onClick={() => void pedirRestauracion({ destino: 'ORIGINAL', momento: 'despues', titulo: 'Restaurar original' })}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurar original
            </Button>
          </div>
        )}

        {pendiente && (
          <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
            <p className="font-semibold">{pendiente.titulo}</p>
            {!vista ? (
              <p>Preparando lo que se va a escribir…</p>
            ) : (
              <>
                <p>
                  Se va a reescribir en Sis2000 <strong>{vista.descripcion}</strong>. La restauración queda en el historial
                  como una versión nueva.
                </p>
                {vista.advertencias.length > 0 && (
                  <ul className="list-disc pl-4">
                    {vista.advertencias.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                )}
                <button type="button" className="underline" onClick={() => setVerDatos((v) => !v)}>
                  {verDatos ? 'Ocultar datos' : 'Ver los datos que se van a escribir'}
                </button>
                {verDatos && (
                  <pre className="max-h-64 overflow-auto rounded border border-amber-200 bg-white p-2 font-mono text-[11px]">
                    {JSON.stringify(vista.datos, null, 2)}
                  </pre>
                )}
                <div>
                  <Label htmlFor={`motivo-restaurar-${entidad}`}>Motivo de la restauración (obligatorio)</Label>
                  <Input
                    id={`motivo-restaurar-${entidad}`}
                    value={motivo}
                    maxLength={500}
                    placeholder="Ej.: se perdió la tarifa al editar el plan"
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={restaurando || motivo.trim().length < 5}
                    onClick={() => void confirmar()}
                  >
                    {restaurando ? 'Restaurando…' : 'Confirmar restauración'}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" disabled={restaurando} onClick={() => setPendiente(null)}>
                    Cancelar
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {versiones.length > 0 && (
          <ol className="space-y-2">
            {versiones.map((v) => (
              <FilaVersion
                key={v.id}
                v={v}
                expandida={expandidas.has(v.id)}
                onAlternar={() => alternar(v.id)}
                deshabilitado={restaurando}
                onRestaurar={(momento) =>
                  void pedirRestauracion({
                    destino: v.id,
                    momento,
                    titulo:
                      momento === 'antes'
                        ? `Volver a cómo estaba antes de la versión ${v.numero}`
                        : `Restaurar la versión ${v.numero}`,
                  })
                }
              />
            ))}
          </ol>
        )}
      </div>
    </SectionPanel>
  );
}

function FilaVersion({
  v,
  expandida,
  onAlternar,
  onRestaurar,
  deshabilitado,
}: {
  v: VersionHistorial;
  expandida: boolean;
  onAlternar: () => void;
  onRestaurar: (momento: MomentoVersion) => void;
  deshabilitado: boolean;
}) {
  const cambios = Array.isArray(v.cambios) ? v.cambios : [];
  const visibles = expandida ? cambios : cambios.slice(0, MAX_CAMBIOS);
  const puedeDespues = v.resultado === 'APLICADA' && v.tipo !== 'ELIMINACION' && (v.estado != null || v.payload != null);
  const puedeAntes = v.anterior != null;
  return (
    <li className="rounded-lg border border-border/60 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          <strong>#{v.numero} · {TIPO_VERSION_LABEL[v.tipo]}</strong>{' '}
          <span
            className={cn(
              'ml-1 rounded-full px-2 py-0.5',
              v.resultado === 'APLICADA' && 'bg-emerald-50 text-emerald-800',
              v.resultado === 'FALLIDA' && 'bg-red-50 text-red-800',
              v.resultado === 'PENDIENTE' && 'bg-slate-100 text-slate-700',
            )}
          >
            {RESULTADO_LABEL[v.resultado]}
          </span>{' '}
          <span className="text-muted-foreground">
            · {fechaHora(v.createdAt)} · {quienHizo(v)}
          </span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {puedeDespues && (
            <Button type="button" size="sm" variant="outline" disabled={deshabilitado} onClick={() => onRestaurar('despues')}>
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurar esta versión
            </Button>
          )}
          {puedeAntes && (
            <Button type="button" size="sm" variant="ghost" disabled={deshabilitado} onClick={() => onRestaurar('antes')}>
              <Undo2 className="h-3.5 w-3.5" />
              {v.tipo === 'ELIMINACION' ? 'Recuperar lo eliminado' : 'Deshacer'}
            </Button>
          )}
        </div>
      </div>
      {v.motivo && <p className="mt-1">Motivo: {v.motivo}</p>}
      {v.restauradaDesde && (
        <p className="mt-1 text-muted-foreground">
          Restaurado desde {v.restauradaDesde === 'ORIGINAL' ? 'la copia original' : 'una versión anterior'}.
        </p>
      )}
      {v.error && <p className="mt-1 text-red-700">{v.error}</p>}
      {cambios.length > 0 && (
        <ul className="mt-2 space-y-0.5 font-mono text-[11px]">
          {visibles.map((c) => (
            <li key={c.campo}>
              <span className="text-muted-foreground">{c.campo}:</span> {valorCorto(c.antes)} → {valorCorto(c.despues)}
            </li>
          ))}
        </ul>
      )}
      {cambios.length > MAX_CAMBIOS && (
        <button type="button" className="mt-1 underline" onClick={onAlternar}>
          {expandida ? 'Ver menos' : `Ver los ${cambios.length} cambios`}
        </button>
      )}
      {cambios.length === 0 && v.resultado === 'APLICADA' && (
        <p className="mt-1 text-muted-foreground">Sin diferencias visibles en los datos leídos.</p>
      )}
    </li>
  );
}
