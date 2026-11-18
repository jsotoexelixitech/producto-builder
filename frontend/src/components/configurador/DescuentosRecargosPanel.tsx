import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BadgePercent, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { advertenciasPorConfirmar } from '@/lib/configurador';
import {
  cuerpoDescRec,
  listaDe,
  normalizarDescRec,
  validarDescRec,
  type DescuentoRecargo,
  type TipoDescRec,
} from '@/lib/configurador-fase2';
import { entenderError, type ErrorEntendible } from '@/lib/errores';
import { ConfirmarDialog } from '@/components/sis2000/AsistentePasos';
import { Alert } from '@/components/ui/alert';
import { AlertaError } from '@/components/ui/errores';
import { Button } from '@/components/ui/button';
import { InfoTip } from '@/components/ui/info-tip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionPanel } from '@/components/ui/section-panel';
import { cn } from '@/lib/utils';

const TEXTOS: Record<TipoDescRec, { titulo: string; efecto: string; tabla: string; nuevo: string }> = {
  dispositivos: {
    titulo: 'Dispositivos de seguridad (% de descuento)',
    efecto: 'descuento',
    tabla: 'madisseg (cdisseg, xdisseg, pdisseg)',
    nuevo: 'Agregar dispositivo',
  },
  sustancias: {
    titulo: 'Sustancias peligrosas (% de recargo)',
    efecto: 'recargo',
    tabla: 'masustac (csustanc, xsustanc, porcenta)',
    nuevo: 'Agregar sustancia',
  },
};

/**
 * Descuentos y recargos del ramo (patrimoniales): dispositivos de seguridad (madisseg) y sustancias peligrosas
 * (masustac). Son del ramo: afectan a todos sus planes. Las tablas no tienen estado: «quitar» pone el % en 0.
 */
export function DescuentosRecargosPanel({ cramo, soloLectura, onCambio }: { cramo: number; soloLectura?: boolean; onCambio?: () => void }) {
  return (
    <SectionPanel
      title="Descuentos y recargos"
      description="Porcentajes que se descuentan por dispositivos de seguridad o se recargan por sustancias peligrosas."
      icon={BadgePercent}
    >
      <div className="space-y-5 text-xs">
        <div role="note" className="alert-banner border-amber-300 bg-amber-50 text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-bold">Estos valores son del ramo {cramo}: afectan a todos sus planes.</p>
        </div>
        <BloqueDescRec cramo={cramo} tipo="dispositivos" soloLectura={soloLectura} onCambio={onCambio} />
        <BloqueDescRec cramo={cramo} tipo="sustancias" soloLectura={soloLectura} onCambio={onCambio} />
      </div>
    </SectionPanel>
  );
}

const VACIO: DescuentoRecargo = { codigo: '', nombre: '', porcentaje: '' };

function BloqueDescRec({ cramo, tipo, soloLectura, onCambio }: { cramo: number; tipo: TipoDescRec; soloLectura?: boolean; onCambio?: () => void }) {
  const t = TEXTOS[tipo];
  const [filas, setFilas] = useState<DescuentoRecargo[] | null>(null);
  const [ediciones, setEdiciones] = useState<Record<string, DescuentoRecargo>>({});
  const [error, setError] = useState<ErrorEntendible | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [nuevo, setNuevo] = useState<DescuentoRecargo>(VACIO);
  const [intento, setIntento] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [porConfirmar, setPorConfirmar] = useState<{ adv: string[]; reintentar: () => void } | null>(null);
  const [quitar, setQuitar] = useState<DescuentoRecargo | null>(null);

  const cargar = useCallback(() => {
    setError(null);
    api
      .listarSis2000DescRec(cramo, tipo)
      .then((r) => {
        setFilas(listaDe(r).map((x) => normalizarDescRec(tipo, x)).sort((a, b) => Number(a.codigo) - Number(b.codigo)));
        setEdiciones({});
      })
      .catch((e) => {
        setFilas([]);
        setError(entenderError(e, { titulo: `No se pudieron leer los ${tipo === 'dispositivos' ? 'dispositivos de seguridad' : 'recargos por sustancias'}` }));
      });
  }, [cramo, tipo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function escribir(accion: (confirmar: boolean) => Promise<unknown>, mensaje: string, titulo: string, confirmar = false): Promise<boolean> {
    setTrabajando(true);
    setError(null);
    setOk(null);
    setAvisos([]);
    try {
      const r = await accion(confirmar);
      const adv = advertenciasPorConfirmar(r, confirmar);
      if (adv.length) {
        setPorConfirmar({ adv, reintentar: () => void escribir(accion, mensaje, titulo, true) });
        return false;
      }
      setPorConfirmar(null);
      const info = (r as { advertencias?: unknown })?.advertencias;
      if (Array.isArray(info) && info.length) setAvisos(info.map(String));
      setOk(mensaje);
      setMotivo('');
      cargar();
      onCambio?.();
      return true;
    } catch (e) {
      const adv = advertenciasPorConfirmar(e, confirmar);
      if (adv.length) setPorConfirmar({ adv, reintentar: () => void escribir(accion, mensaje, titulo, true) });
      else setError(entenderError(e, { titulo, duplicado: 'Ese código ya existe en el ramo: edítalo en la tabla.' }));
      return false;
    } finally {
      setTrabajando(false);
    }
  }

  const extra = (confirmar: boolean) => ({ motivoCambio: motivo || undefined, ...(confirmar ? { confirmar: true } : {}) });

  function guardarFila(original: DescuentoRecargo, f: DescuentoRecargo) {
    if (Object.keys(validarDescRec(f, false)).length) return;
    void escribir(
      (c) => api.editarSis2000DescRec(cramo, tipo, original.codigo, { ...cuerpoDescRec(tipo, f, false), ...extra(c) }),
      `Código ${original.codigo} guardado (${f.porcentaje} % de ${t.efecto}).`,
      'No se pudo guardar el cambio',
    );
  }

  function agregar() {
    setIntento(true);
    if (Object.keys(validarDescRec(nuevo, true, filas ?? [])).length) return;
    void escribir(
      (c) => api.agregarSis2000DescRec(cramo, tipo, { ...cuerpoDescRec(tipo, nuevo, true), ...extra(c) }),
      `${nuevo.codigo.trim() ? `Código ${nuevo.codigo}` : `«${nuevo.nombre.trim()}»`} agregado con ${nuevo.porcentaje} % de ${t.efecto}.`,
      'No se pudo agregar',
    ).then((g) => {
      if (!g) return;
      setNuevo(VACIO);
      setIntento(false);
    });
  }

  async function confirmarQuitar() {
    if (!quitar) return;
    const f = { ...quitar, porcentaje: '0' };
    const g = await escribir(
      (c) => api.editarSis2000DescRec(cramo, tipo, quitar.codigo, { ...cuerpoDescRec(tipo, f, false), ...extra(c) }),
      `Código ${quitar.codigo} queda sin efecto (0 %). La fila no se borra.`,
      'No se pudo quitar',
    );
    if (g) setQuitar(null);
  }

  const erroresNuevo = intento ? validarDescRec(nuevo, true, filas ?? []) : {};

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1 text-sm font-semibold text-slate-800">
        {t.titulo}
        <InfoTip text={`En Sis2000: ${t.tabla}. No tiene estado activo/inactivo: para quitarlo se pone el % en 0.`} />
      </p>
      <AlertaError error={error} onReintentar={cargar} />
      {ok && <Alert variant="success">{ok}</Alert>}
      {avisos.length > 0 && (
        <Alert variant="warning">
          <ul className="list-disc space-y-0.5 pl-4">
            {avisos.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </Alert>
      )}

      {filas === null ? (
        <p className="text-slate-500">Leyendo…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[560px] text-left">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase text-slate-500">
              <tr>
                <th className="w-20 px-3 py-2">Código</th>
                <th className="px-3 py-2">Descripción</th>
                <th className="w-32 px-3 py-2">% de {t.efecto}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                    El ramo no tiene filas aquí.
                  </td>
                </tr>
              )}
              {filas.map((f) => {
                const ed = ediciones[f.codigo] ?? f;
                const cambiado = ed.nombre !== f.nombre || ed.porcentaje !== f.porcentaje;
                const err = cambiado ? validarDescRec(ed, false) : {};
                const enCero = Number(f.porcentaje || 0) === 0;
                return (
                  <tr key={f.codigo} className={cn('border-b border-slate-100 align-top last:border-0', enCero && 'text-slate-400')}>
                    <td className="px-3 py-2 font-mono">{f.codigo}</td>
                    <td className="px-3 py-2">
                      {soloLectura ? (
                        f.nombre || '—'
                      ) : (
                        <>
                          <Input
                            aria-label={`Descripción del código ${f.codigo}`}
                            className={cn('h-8 text-xs', err.nombre && 'border-red-300')}
                            value={ed.nombre}
                            maxLength={tipo === 'dispositivos' ? 60 : 255}
                            onChange={(e) => setEdiciones({ ...ediciones, [f.codigo]: { ...ed, nombre: e.target.value } })}
                          />
                          {err.nombre && <p className="mt-0.5 text-[11px] text-red-700">{err.nombre}</p>}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {soloLectura ? (
                        `${f.porcentaje || '0'} %`
                      ) : (
                        <>
                          <Input
                            aria-label={`Porcentaje del código ${f.codigo}`}
                            inputMode="decimal"
                            className={cn('h-8 text-xs', err.porcentaje && 'border-red-300')}
                            value={ed.porcentaje}
                            onChange={(e) => setEdiciones({ ...ediciones, [f.codigo]: { ...ed, porcentaje: e.target.value } })}
                          />
                          {err.porcentaje && <p className="mt-0.5 text-[11px] text-red-700">{err.porcentaje}</p>}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!soloLectura && (
                        <div className="flex justify-end gap-1">
                          {cambiado && (
                            <Button type="button" size="sm" variant="outline" disabled={trabajando || Object.keys(err).length > 0} onClick={() => guardarFila(f, ed)}>
                              Guardar
                            </Button>
                          )}
                          {!enCero && !cambiado && (
                            <Button type="button" size="sm" variant="ghost" disabled={trabajando} onClick={() => setQuitar(f)}>
                              Quitar (0 %)
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!soloLectura && (
        <div className="space-y-3 rounded-xl border border-dashed border-slate-200 p-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <Label htmlFor={`dr-${tipo}-cod`}>Código (opcional: vacío = el siguiente libre)</Label>
              <Input
                id={`dr-${tipo}-cod`}
                inputMode="numeric"
                value={nuevo.codigo}
                className={cn(erroresNuevo.codigo && 'border-red-300')}
                onChange={(e) => setNuevo({ ...nuevo, codigo: e.target.value })}
              />
              {erroresNuevo.codigo && <p className="mt-0.5 text-[11px] text-red-700">{erroresNuevo.codigo}</p>}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor={`dr-${tipo}-nom`}>Descripción</Label>
              <Input
                id={`dr-${tipo}-nom`}
                value={nuevo.nombre}
                maxLength={tipo === 'dispositivos' ? 60 : 255}
                className={cn(erroresNuevo.nombre && 'border-red-300')}
                onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
              />
              {erroresNuevo.nombre && <p className="mt-0.5 text-[11px] text-red-700">{erroresNuevo.nombre}</p>}
            </div>
            <div>
              <Label htmlFor={`dr-${tipo}-pct`}>% de {t.efecto}</Label>
              <Input
                id={`dr-${tipo}-pct`}
                inputMode="decimal"
                value={nuevo.porcentaje}
                className={cn(erroresNuevo.porcentaje && 'border-red-300')}
                onChange={(e) => setNuevo({ ...nuevo, porcentaje: e.target.value })}
              />
              {erroresNuevo.porcentaje && <p className="mt-0.5 text-[11px] text-red-700">{erroresNuevo.porcentaje}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <Label htmlFor={`dr-${tipo}-motivo`}>Motivo (opcional, queda en el historial)</Label>
              <Input id={`dr-${tipo}-motivo`} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>
            <Button type="button" size="sm" onClick={agregar} disabled={trabajando}>
              <Plus className="h-3.5 w-3.5" />
              {t.nuevo}
            </Button>
          </div>
        </div>
      )}

      {quitar && (
        <ConfirmarDialog
          titulo="Dejar sin efecto"
          confirmar="Poner en 0 %"
          cancelar="No cambiar"
          ocupado={trabajando}
          onConfirmar={() => void confirmarQuitar()}
          onCancelar={() => setQuitar(null)}
        >
          <p>
            «{quitar.nombre || quitar.codigo}» pasa de {quitar.porcentaje} % a 0 % de {t.efecto} en todos los planes del ramo {cramo}. La fila
            no se borra (la tabla no tiene estado activo/inactivo).
          </p>
        </ConfirmarDialog>
      )}

      {porConfirmar && (
        <ConfirmarDialog
          titulo="Revisa antes de guardar"
          confirmar="Guardar de todas formas"
          cancelar="No guardar"
          ocupado={trabajando}
          onConfirmar={porConfirmar.reintentar}
          onCancelar={() => setPorConfirmar(null)}
        >
          <p>Sis2000 avisa lo siguiente. El cambio aplica a todos los planes del ramo {cramo}:</p>
          <ul className="list-disc space-y-1 pl-5">
            {porConfirmar.adv.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </ConfirmarDialog>
      )}
    </div>
  );
}
