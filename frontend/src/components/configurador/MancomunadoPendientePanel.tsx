import { useEffect, useState } from 'react';
import { Trash2, UsersRound } from 'lucide-react';
import { api } from '@/lib/api';
import { normalizarParametroAuto } from '@/lib/configurador-auto';
import {
  MIN_PRODUCTORES,
  filasDeConfig,
  textoSuma,
  validarMancomunado,
  type PendienteMancomunado,
} from '@/lib/configurador-mancomunado';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { InfoTip } from '@/components/ui/info-tip';
import { Input } from '@/components/ui/input';
import { BuscadorConLista } from '@/components/ui/lista-flotante';

interface Props {
  value: PendienteMancomunado;
  onChange: (v: PendienteMancomunado) => void;
  /** Al editar un plan: id maestro del plan para leer el mancomunado actual (GET). Sin él (plan nuevo) todo queda pendiente. */
  planIdEdicion?: string | null;
  /** Lo que hay hoy en Sis2000 (solo al editar): sirve para saber qué cambió y si falta el catálogo. */
  onOriginal?: (original: PendienteMancomunado, dominioCreado: boolean) => void;
  /** Mostrar los errores de los campos (después de intentar crear). */
  mostrarErrores?: boolean;
  /** Aviso (p. ej. el PUT falló al crear): se muestra dentro de la sección. */
  aviso?: string | null;
  onReintentar?: () => void;
  reintentando?: boolean;
  className?: string;
}

/**
 * «Productores mancomunados» del paso «Datos del plan» del Combo: modo pendiente. Nada se escribe aquí; el Combo hace el
 * PUT v1/configurador/planes/:cramo/:cplan/mancomunado justo después de crear el plan (o de guardar los cambios).
 */
export function MancomunadoPendientePanel({ value, onChange, planIdEdicion, onOriginal, mostrarErrores, aviso, onReintentar, reintentando, className }: Props) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<Array<{ codigo: number; nombre: string }>>([]);
  const [buscando, setBuscando] = useState(false);
  const [listaFallo, setListaFallo] = useState(false);
  const [leyendo, setLeyendo] = useState(Boolean(planIdEdicion));
  const [sinDominio, setSinDominio] = useState(false);
  const [errorLectura, setErrorLectura] = useState<string | null>(null);

  // Editar: se muestra el mancomunado actual de Sis2000.
  useEffect(() => {
    if (!planIdEdicion) return;
    let vivo = true;
    setLeyendo(true);
    api
      .leerSis2000Mancomunado(planIdEdicion)
      .then((r) => {
        if (!vivo) return;
        const d = normalizarParametroAuto(r);
        const filas = d.existe && d.activo ? filasDeConfig(d.config) : [];
        const actual = { activo: filas.length > 0, filas };
        setSinDominio(!d.dominioCreado);
        onChange(actual);
        onOriginal?.(actual, d.dominioCreado);
      })
      .catch((e) => {
        if (!vivo) return;
        setErrorLectura(e instanceof Error ? e.message : 'No se pudo leer el mancomunado del plan.');
        onOriginal?.({ activo: false, filas: [] }, true);
      })
      .finally(() => vivo && setLeyendo(false));
    return () => {
      vivo = false;
    };
    // Solo al abrir el plan: onChange/onOriginal cambian de identidad en cada render del Combo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planIdEdicion]);

  useEffect(() => {
    if (!value.activo) return;
    const t = setTimeout(() => {
      setBuscando(true);
      api
        .listSis2000Productores(q.trim())
        .then((rows) => {
          setResultados((rows ?? []).map((r) => ({ codigo: Number(r.cproductor), nombre: String(r.xproductor ?? '').trim() })));
          setListaFallo(false);
        })
        .catch(() => {
          setResultados([]);
          setListaFallo(true);
        })
        .finally(() => setBuscando(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, value.activo]);

  const errores = validarMancomunado(value.filas);
  const suma = textoSuma(value.filas);
  const filasCon = (filas: PendienteMancomunado['filas']) => onChange({ ...value, filas });

  function agregar(cproductor: number, xproductor?: string) {
    if (!Number.isInteger(cproductor) || cproductor <= 0 || value.filas.some((f) => f.cproductor === cproductor)) return;
    filasCon([...value.filas, { cproductor, xproductor, ppart: '' }]);
  }

  return (
    <div className={`space-y-3 rounded-md border border-border p-4 ${className ?? ''}`} data-testid="mancomunado-pendiente" id="combo-manc">
      <div className="flex items-center gap-2">
        <UsersRound className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-800">
          Productores mancomunados
          <InfoTip text={'Productores que comparten cada póliza de este plan, con su % de participación (suman 100). Se guardan en las características del plan justo después de crearlo; la emisión los aplica sola a cada póliza y el productor principal sigue siendo el del canal.\nEn Sis2000: macatvalores PLAN_MANCOMUNADO → adprod_mult'} />
        </h3>
      </div>
      {leyendo && <p className="text-xs text-slate-500">Leyendo el mancomunado actual del plan…</p>}
      {errorLectura && <Alert variant="warning">No se pudo leer el mancomunado actual: {errorLectura}</Alert>}
      {sinDominio && (
        <Alert variant="warning">Sis2000 aún no tiene el catálogo PLAN_MANCOMUNADO (falta el script del DBA): lo que elijas no se podrá guardar todavía.</Alert>
      )}
      <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          checked={value.activo}
          disabled={leyendo}
          onChange={(e) => onChange({ ...value, activo: e.target.checked })}
        />
        Este plan se emite con productores mancomunados
      </label>
      {!value.activo && <p className="text-xs text-slate-500">Sin mancomunado: el plan se emite como siempre.</p>}
      {value.activo && (
        <>
          <BuscadorConLista
            id="combo-manc-buscar"
            placeholder="Buscar productor por nombre o código…"
            q={q}
            onQ={setQ}
            opciones={resultados}
            buscando={buscando}
            listaFallo={listaFallo}
            yaElegido={(codigo) => value.filas.some((f) => f.cproductor === codigo)}
            onElegir={(o) => agregar(o.codigo, o.nombre)}
            mostrarAlEnfocar
          />
          {listaFallo && <p className="text-[11px] text-amber-700">No se pudo cargar la lista de productores; inténtalo de nuevo en un momento.</p>}
          <div className="overflow-x-auto">
            <table className="min-w-[420px] text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1 pr-3 font-medium">Productor</th>
                  <th className="py-1 pr-3 font-medium">% de participación</th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {value.filas.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-1 text-slate-500">
                      Agrega al menos {MIN_PRODUCTORES} productores.
                    </td>
                  </tr>
                )}
                {value.filas.map((f) => {
                  const err = mostrarErrores ? errores.porProductor[f.cproductor] : undefined;
                  return (
                    <tr key={f.cproductor}>
                      <td className="py-1 pr-3 text-slate-700">
                        {f.cproductor}
                        {f.xproductor ? ` · ${f.xproductor}` : ''}
                      </td>
                      <td className="py-1 pr-3">
                        <Input
                          id={`combo-manc-ppart-${f.cproductor}`}
                          inputMode="decimal"
                          className="h-8 w-28"
                          value={f.ppart}
                          aria-invalid={err ? true : undefined}
                          onChange={(e) => filasCon(value.filas.map((x) => (x.cproductor === f.cproductor ? { ...x, ppart: e.target.value } : x)))}
                        />
                        {err && <p className="text-[11px] text-red-600">{err}</p>}
                      </td>
                      <td className="py-1">
                        <Button type="button" size="sm" variant="ghost" aria-label={`Quitar ${f.cproductor}`} onClick={() => filasCon(value.filas.filter((x) => x.cproductor !== f.cproductor))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="py-1 pr-3 font-medium text-slate-700">Total</td>
                  <td className={`py-1 pr-3 font-medium ${suma === '100' ? 'text-emerald-700' : 'text-amber-700'}`} data-testid="combo-manc-total">
                    {suma} %{suma === '100' ? '' : ' (debe ser 100)'}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          {mostrarErrores && errores.general && <p className="text-[11px] text-red-600">{errores.general}</p>}
        </>
      )}
      {aviso && (
        <Alert variant="warning">
          <p>{aviso}</p>
          {onReintentar && (
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={onReintentar} disabled={reintentando}>
              Reintentar guardar el mancomunado
            </Button>
          )}
        </Alert>
      )}
    </div>
  );
}
