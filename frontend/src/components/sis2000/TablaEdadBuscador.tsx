import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { traducirErrorSis2000 } from '@/lib/sis2000-tramos';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { TablaEdad, TablaEdadResumen } from './TablaEdadDialog';

const formato = (v: unknown, max = 6) =>
  Number(v ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: max });

interface Props {
  /** Texto del encabezado, p. ej. «Cobertura 3 · Gastos médicos». */
  destino: string;
  /** Código que ya tiene la cobertura (se muestra elegido al abrir). */
  valorActual?: string;
  /** Si es true se ofrece «Usar en todas las coberturas». */
  permitirTodas?: boolean;
  onElegir: (codigo: string, enTodas: boolean) => void;
  /** Abre «Crear tabla nueva» (con el texto buscado como código sugerido si no existe). */
  onCrearNueva: (codigoSugerido: string) => void;
  onClose: () => void;
}

/**
 * Buscador de tablas de tasas por edad existentes (mapltabedad): código, descripción, cuántos tramos tiene y vista
 * previa de los tramos. Evita crear tablas repetidas.
 */
export function TablaEdadBuscador({ destino, valorActual = '', permitirTodas = false, onElegir, onCrearNueva, onClose }: Props) {
  const [q, setQ] = useState(valorActual.trim());
  const [resultados, setResultados] = useState<TablaEdadResumen[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [elegida, setElegida] = useState(valorActual.trim().toUpperCase());
  const [vista, setVista] = useState<TablaEdad | null>(null);
  const [cargandoVista, setCargandoVista] = useState(false);
  const [errorVista, setErrorVista] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setBuscando(true);
    const t = setTimeout(() => {
      api
        .buscarSis2000TablasEdad(q.trim())
        .then((rows) => {
          if (!vigente) return;
          setResultados(
            (rows ?? []).map((r) => ({
              ctablaedad: String(r.ctablaedad ?? '').trim(),
              xtablaedad: String(r.xtablaedad ?? '').trim(),
              ntramos: Number(r.ntramos ?? 0),
              nedad_min: r.nedad_min == null ? null : Number(r.nedad_min),
              nedad_max: r.nedad_max == null ? null : Number(r.nedad_max),
            })),
          );
          setErrorBusqueda(null);
        })
        .catch((e: unknown) => {
          if (!vigente) return;
          setResultados([]);
          setErrorBusqueda(
            `No se pudo buscar en Sis2000. ${traducirErrorSis2000(e instanceof Error ? e.message : '')} Puedes escribir el código directamente en la cobertura.`,
          );
        })
        .finally(() => vigente && setBuscando(false));
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [q]);

  useEffect(() => {
    if (!elegida) {
      setVista(null);
      return;
    }
    let vigente = true;
    setCargandoVista(true);
    setErrorVista(null);
    api
      .leerSis2000TablaEdad(elegida)
      .then((t) => vigente && setVista(t))
      .catch((e: unknown) => {
        if (!vigente) return;
        setVista(null);
        setErrorVista(traducirErrorSis2000(e instanceof Error ? e.message : 'No se pudo leer la tabla.'));
      })
      .finally(() => vigente && setCargandoVista(false));
    return () => {
      vigente = false;
    };
  }, [elegida]);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onClose]);

  const sinTramos = Boolean(vista && !(vista.tramos ?? []).length);
  const codigoBuscado = q.trim().toUpperCase();
  const exacta = resultados.some((r) => r.ctablaedad.toUpperCase() === codigoBuscado);

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Elegir tabla de tasas por edad"
    >
      <div className="w-full max-w-4xl rounded-2xl bg-white p-4 shadow-2xl sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">Elegir tabla de tasas por edad</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {destino}. Busca una tabla que ya exista en Sis2000 por código o descripción y revisa sus tramos antes de
              usarla. Crea una nueva solo si ninguna sirve.
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            autoFocus
            aria-label="Buscar tabla por código o descripción"
            placeholder="Buscar por código o descripción (ej.: TEMP1, viajero, salud)…"
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {errorBusqueda && (
          <Alert variant="warning" className="mb-3">
            {errorBusqueda}
          </Alert>
        )}

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200">
            {buscando && !resultados.length ? (
              <p className="p-4 text-center text-xs text-slate-500">Buscando…</p>
            ) : !resultados.length ? (
              <p className="p-4 text-center text-xs text-slate-500">
                {q.trim() ? 'No hay tablas que coincidan.' : 'No se encontraron tablas.'}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {resultados.map((r) => (
                  <li key={r.ctablaedad}>
                    <button
                      type="button"
                      onClick={() => setElegida(r.ctablaedad)}
                      className={cn(
                        'flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-xs hover:bg-indigo-50',
                        elegida === r.ctablaedad.toUpperCase() && 'bg-indigo-50 ring-1 ring-inset ring-indigo-300',
                      )}
                    >
                      <span className="font-mono font-bold text-slate-800">{r.ctablaedad}</span>
                      <span className="text-slate-600">{r.xtablaedad || 'Sin descripción'}</span>
                      <span className={cn('text-[11px]', r.ntramos ? 'text-slate-500' : 'font-semibold text-rose-600')}>
                        {r.ntramos
                          ? `${r.ntramos} tramo${r.ntramos === 1 ? '' : 's'} · edades ${r.nedad_min ?? '—'} a ${r.nedad_max ?? '—'}`
                          : 'Sin tramos: no se puede usar'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            {!elegida ? (
              <p className="py-6 text-center text-xs text-slate-500">Elige una tabla de la lista para ver sus tramos.</p>
            ) : cargandoVista ? (
              <p className="py-6 text-center text-xs text-slate-500">Cargando tramos de {elegida}…</p>
            ) : errorVista ? (
              <Alert variant="error">{errorVista}</Alert>
            ) : vista ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-700">
                  <span className="font-bold">{vista.ctablaedad}</span> · {vista.xtablaedad || 'Sin descripción'}
                </p>
                <div className="max-h-56 overflow-auto rounded-lg border border-slate-100">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-2 py-1.5">Edades</th>
                        <th className="px-2 py-1.5 text-right">Tasa (%)</th>
                        <th className="px-2 py-1.5 text-right">Prima fija</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(vista.tramos ?? []).map((t) => (
                        <tr key={`${t.nedad_min}-${t.nedad_max}`} className="border-t border-slate-100">
                          <td className="px-2 py-1">
                            {t.nedad_min} a {t.nedad_max} años
                          </td>
                          <td className="px-2 py-1 text-right">{Number(t.pprima) > 0 ? formato(t.pprima) : '—'}</td>
                          <td className="px-2 py-1 text-right">{Number(t.mprima) > 0 ? formato(t.mprima, 2) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {sinTramos && (
                  <p className="text-xs font-semibold text-rose-600">Esta tabla no tiene tramos: un plan no puede usarla.</p>
                )}
                <p className="text-[11px] text-slate-500">
                  {(vista.usada_por ?? []).length
                    ? `Ya la usan ${(vista.usada_por ?? []).length} cobertura(s) de planes: ${(vista.usada_por ?? [])
                        .slice(0, 6)
                        .map((p) => `${p.cplan} (ramo ${p.cramo})`)
                        .join(', ')}${(vista.usada_por ?? []).length > 6 ? '…' : ''}.`
                    : 'Ningún plan la usa todavía.'}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onCrearNueva(exacta ? '' : codigoBuscado.replace(/[^A-Z0-9_-]/g, '').slice(0, 10))}
          >
            <Plus className="h-3.5 w-3.5" />
            Crear tabla nueva
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            {permitirTodas && (
              <Button
                type="button"
                variant="outline"
                disabled={!vista || sinTramos}
                onClick={() => vista && onElegir(vista.ctablaedad, true)}
              >
                Usar en todas las coberturas
              </Button>
            )}
            <Button type="button" disabled={!vista || sinTramos} onClick={() => vista && onElegir(vista.ctablaedad, false)}>
              Usar esta tabla
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
