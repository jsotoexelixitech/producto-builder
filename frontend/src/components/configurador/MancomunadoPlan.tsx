import { useCallback, useEffect, useMemo, useState } from 'react';
import { Save, Trash2, UsersRound } from 'lucide-react';
import { api } from '@/lib/api';
import { TEXTO_409_AUTO, normalizarParametroAuto, type ParametroAuto } from '@/lib/configurador-auto';
import {
  MIN_PRODUCTORES,
  cuerpoMancomunado,
  filasDeConfig,
  mancomunadoValido,
  textoSuma,
  validarMancomunado,
  type FilaMancomunado,
} from '@/lib/configurador-mancomunado';
import { entenderError, type ErrorEntendible } from '@/lib/errores';
import { Alert } from '@/components/ui/alert';
import { AlertaError } from '@/components/ui/errores';
import { Button } from '@/components/ui/button';
import { InfoTip } from '@/components/ui/info-tip';
import { Input } from '@/components/ui/input';
import { BuscadorConLista } from '@/components/ui/lista-flotante';
import { CampoMotivo, DialogoConfirmarEscritura, EstadoEscritura, useEscritura } from './EscrituraConfirmada';

/**
 * Productores mancomunados del plan (macatvalores PLAN_MANCOMUNADO, cualquier ramo). Fijos por plan: la emisión los
 * aplica a cada póliza (adprod_mult) y el productor principal sigue siendo el del canal. Sin interruptor activo = emisión
 * de siempre. Se muestra dentro de «Quién lo vende».
 */
export function MancomunadoPlan({ planId, soloLectura }: { planId: string; soloLectura?: boolean }) {
  const esc = useEscritura();
  const [dato, setDato] = useState<ParametroAuto | null>(null);
  const [error, setError] = useState<ErrorEntendible | null>(null);
  const [activo, setActivo] = useState(false);
  const [filas, setFilas] = useState<FilaMancomunado[]>([]);
  const [intento, setIntento] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<Array<{ codigo: number; nombre: string }>>([]);
  const [buscando, setBuscando] = useState(false);
  const [listaFallo, setListaFallo] = useState(false);

  const cargar = useCallback(() => {
    setError(null);
    api
      .leerSis2000Mancomunado(planId)
      .then((r) => setDato(normalizarParametroAuto(r)))
      .catch((e) => {
        setDato(normalizarParametroAuto({ dominioCreado: true }));
        setError(entenderError(e, { titulo: 'No se pudo leer el mancomunado del plan' }));
      });
  }, [planId]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const original = useMemo(() => (dato?.existe && dato.activo ? filasDeConfig(dato.config) : []), [dato]);
  useEffect(() => {
    setFilas(original);
    setActivo(original.length > 0);
    setIntento(false);
  }, [original]);

  useEffect(() => {
    if (!activo || soloLectura) return;
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
  }, [q, activo, soloLectura]);

  const errores = validarMancomunado(filas);
  const suma = textoSuma(filas);
  const bloqueado = soloLectura || esc.trabajando || !dato || !dato.dominioCreado || dato.otroRamo != null;
  const cambio = JSON.stringify(filas.map((f) => [f.cproductor, f.ppart])) !== JSON.stringify(original.map((f) => [f.cproductor, f.ppart]));
  const yaGuardado = Boolean(dato?.existe && dato.activo);

  function agregar(cproductor: number, xproductor?: string) {
    if (!Number.isInteger(cproductor) || cproductor <= 0 || filas.some((f) => f.cproductor === cproductor)) return;
    setFilas([...filas, { cproductor, xproductor, ppart: '' }]);
  }
  const cambiar = (c: number, ppart: string) => setFilas(filas.map((f) => (f.cproductor === c ? { ...f, ppart } : f)));

  function guardar() {
    setIntento(true);
    if (!mancomunadoValido(errores)) return;
    void esc.ejecutar(() => api.guardarSis2000Mancomunado(planId, { ...cuerpoMancomunado(filas), motivoCambio: motivo || undefined }), {
      ok: 'Mancomunado guardado y activo para el plan.',
      titulo: 'No se pudo guardar el mancomunado',
      duplicado: TEXTO_409_AUTO,
      alTerminar: () => {
        setMotivo('');
        cargar();
      },
    });
  }

  function desactivar() {
    if (!window.confirm('¿Desactivar el mancomunado? Las pólizas nuevas se emiten como siempre. Lo guardado queda en Sis2000 (inactivo) y en el historial.')) return;
    void esc.ejecutar(() => api.desactivarSis2000Mancomunado(planId, motivo || undefined), {
      ok: 'Mancomunado desactivado: el plan se emite como siempre.',
      titulo: 'No se pudo desactivar el mancomunado',
      duplicado: TEXTO_409_AUTO,
      alTerminar: () => {
        setMotivo('');
        cargar();
      },
    });
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3" data-testid="mancomunado">
      <div className="flex items-center gap-2">
        <UsersRound className="h-4 w-4 text-slate-500" />
        <h4 className="text-sm font-medium text-slate-800">
          Mancomunado
          <InfoTip text={'Productores que comparten cada póliza de este plan, con su % de participación (suman 100). Son fijos por plan: la emisión los aplica sola a cada póliza y la comisión se reparte entre ellos. El productor principal sigue siendo el del canal.\nEn Sis2000: macatvalores PLAN_MANCOMUNADO → adprod_mult'} />
        </h4>
      </div>
      <AlertaError error={error} onReintentar={cargar} />
      <EstadoEscritura esc={esc} />
      {!dato ? (
        <p className="text-slate-500">Leyendo mancomunado…</p>
      ) : (
        <>
          {!dato.dominioCreado && (
            <Alert variant="warning">Sis2000 todavía no tiene el catálogo para guardar el mancomunado (falta el script del DBA). Puedes ver el formulario, pero no guardar hasta que Técnica lo cree.</Alert>
          )}
          {dato.otroRamo != null && <Alert variant="error">Este código de plan ya tiene mancomunado guardado para el ramo {dato.otroRamo}. No se puede guardar aquí hasta corregirlo.</Alert>}
          {dato.errorJson && <Alert variant="warning">Lo guardado en Sis2000 no se pudo leer ({dato.errorJson}). Al guardar se reemplaza.</Alert>}
          <label className="inline-flex cursor-pointer items-center gap-2 text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={activo} disabled={bloqueado} onChange={(e) => setActivo(e.target.checked)} />
            Este plan se emite con productores mancomunados
          </label>
          {!activo && yaGuardado && !soloLectura && <Alert variant="info">El mancomunado sigue activo en Sis2000. Para apagarlo usa «Desactivar».</Alert>}
          {!activo && !yaGuardado && <p className="text-slate-500">Sin mancomunado: el plan se emite como siempre.</p>}
          {activo && (
            <>
              {!soloLectura && (
                <div className="space-y-1">
                  <BuscadorConLista
                    id="manc-buscar"
                    placeholder="Buscar productor por nombre o código…"
                    q={q}
                    onQ={setQ}
                    opciones={resultados}
                    buscando={buscando}
                    listaFallo={listaFallo}
                    yaElegido={(codigo) => filas.some((f) => f.cproductor === codigo)}
                    onElegir={(o) => agregar(o.codigo, o.nombre)}
                    mostrarAlEnfocar
                  />
                  {listaFallo && <p className="text-[11px] text-amber-700">No se pudo cargar la lista de productores; inténtalo de nuevo en un momento.</p>}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="min-w-[420px] text-left">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Productor</th>
                      <th className="py-1 pr-3 font-medium">% de participación</th>
                      <th className="py-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {filas.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-1 text-slate-500">
                          Agrega al menos {MIN_PRODUCTORES} productores.
                        </td>
                      </tr>
                    )}
                    {filas.map((f) => {
                      const err = intento ? errores.porProductor[f.cproductor] : undefined;
                      return (
                        <tr key={f.cproductor}>
                          <td className="py-1 pr-3 text-slate-700">
                            {f.cproductor}
                            {f.xproductor ? ` · ${f.xproductor}` : ''}
                          </td>
                          <td className="py-1 pr-3">
                            <Input
                              id={`manc-ppart-${f.cproductor}`}
                              inputMode="decimal"
                              className="h-8 w-28"
                              value={f.ppart}
                              disabled={bloqueado}
                              aria-invalid={err ? true : undefined}
                              onChange={(e) => cambiar(f.cproductor, e.target.value)}
                            />
                            {err && <p className="text-[11px] text-red-600">{err}</p>}
                          </td>
                          <td className="py-1">
                            {!soloLectura && (
                              <Button type="button" size="sm" variant="ghost" aria-label={`Quitar ${f.cproductor}`} disabled={bloqueado} onClick={() => setFilas(filas.filter((x) => x.cproductor !== f.cproductor))}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="py-1 pr-3 font-medium text-slate-700">Total</td>
                      <td className={`py-1 pr-3 font-medium ${suma === '100' ? 'text-emerald-700' : 'text-amber-700'}`} data-testid="manc-total">
                        {suma} %{suma === '100' ? '' : ' (debe ser 100)'}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              {intento && errores.general && <p className="text-[11px] text-red-600">{errores.general}</p>}
            </>
          )}
          {!soloLectura && (activo || yaGuardado) && (
            <div className="flex flex-wrap items-end gap-3">
              <CampoMotivo id="manc-motivo" valor={motivo} onChange={setMotivo} />
              {activo && (
                <Button type="button" size="sm" onClick={guardar} disabled={bloqueado || !cambio}>
                  <Save className="h-3.5 w-3.5" />
                  Guardar mancomunado
                </Button>
              )}
              {yaGuardado && (
                <Button type="button" size="sm" variant="outline" onClick={desactivar} disabled={bloqueado}>
                  Desactivar
                </Button>
              )}
            </div>
          )}
        </>
      )}
      <DialogoConfirmarEscritura esc={esc} />
    </div>
  );
}
