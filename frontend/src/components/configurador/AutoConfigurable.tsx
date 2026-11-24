import { useCallback, useEffect, useMemo, useState } from 'react';
import { Gauge, Save } from 'lucide-react';
import { api } from '@/lib/api';
import {
  TEXTO_409_AUTO,
  coberturasUnicas,
  cuerpoDeducibles,
  cuerpoTasaDiaria,
  deduciblesDeConfig,
  deduciblesValidos,
  errorOpcionDeducible,
  normalizarParametroAuto,
  sinErrores,
  tasaAnualTexto,
  tasaDiariaDeConfig,
  validarDeducibles,
  validarTasaDiaria,
  type DeduciblesForm,
  type ParametroAuto,
  type TasaDiariaForm,
} from '@/lib/configurador-auto';
import { entenderError, type ErrorEntendible } from '@/lib/errores';
import { Alert } from '@/components/ui/alert';
import { AlertaError } from '@/components/ui/errores';
import { Button } from '@/components/ui/button';
import { InfoTip } from '@/components/ui/info-tip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionPanel } from '@/components/ui/section-panel';
import { TablaEditable, type ColumnaEditable, type FilaTexto } from './TablaEditable';
import { CampoMotivo, DialogoConfirmarEscritura, EstadoEscritura, useEscritura } from './EscrituraConfirmada';

// Auto configurable por plan (.antigravity/CONTRATO-AUTO-CONFIGURABLE.md). Dos bloques que se muestran dentro de los
// paneles que ya existen: la tasa diaria por tipo de vehículo en «Tarifa por días» y el descuento por deducible en
// «Deducibles». Se guardan en Sis2000 (macatvalores) y solo los usa el cálculo de auto cuando el plan tiene la fila
// activa; sin ella el plan cotiza como siempre.

type TipoParametro = 'tasa-diaria' | 'deducibles';
type Cobertura = { ccobertura: string; nombre: string };

/** Lee el parámetro del plan; `null` mientras carga. */
function useParametroAuto(planId: string, tipo: TipoParametro) {
  const [dato, setDato] = useState<ParametroAuto | null>(null);
  const [error, setError] = useState<ErrorEntendible | null>(null);
  const cargar = useCallback(() => {
    setError(null);
    api
      .leerSis2000AutoParametro(planId, tipo)
      .then((r) => setDato(normalizarParametroAuto(r)))
      .catch((e) => {
        setDato(normalizarParametroAuto({ dominioCreado: true }));
        setError(entenderError(e, { titulo: 'No se pudo leer la configuración de auto del plan' }));
      });
  }, [planId, tipo]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  return { dato, error, cargar };
}

/** Avisos de estado: dominio sin crear (no se puede guardar), fila de otro ramo, JSON ilegible o fila inactiva. */
function EstadoParametro({ dato, nombre }: { dato: ParametroAuto; nombre: string }) {
  if (!dato.dominioCreado) {
    return (
      <Alert variant="warning">
        Sis2000 todavía no tiene el catálogo para guardar {nombre} (falta el script del DBA). Puedes ver el formulario, pero no guardar hasta que Técnica lo cree.
      </Alert>
    );
  }
  if (dato.otroRamo != null) {
    return <Alert variant="error">Este código de plan ya tiene {nombre} guardado para el ramo {dato.otroRamo}. No se puede guardar aquí hasta corregirlo.</Alert>;
  }
  if (dato.errorJson) return <Alert variant="warning">Lo guardado en Sis2000 no se pudo leer ({dato.errorJson}). Al guardar se reemplaza.</Alert>;
  if (dato.existe && dato.activo === false) return <Alert variant="info">Hay {nombre} guardado pero desactivado: el plan cotiza como siempre. Guardar lo vuelve a activar.</Alert>;
  if (!dato.existe) return <Alert variant="info">El plan no tiene {nombre}: cotiza con su tarifa normal.</Alert>;
  return null;
}

/** Casillas con las coberturas del plan; marca también las guardadas que ya no están en el plan. */
function CoberturasAfectadas({
  id,
  coberturas,
  marcadas,
  onChange,
  error,
  deshabilitado,
}: {
  id: string;
  coberturas: Cobertura[];
  marcadas: string[];
  onChange: (v: string[]) => void;
  error?: string;
  deshabilitado?: boolean;
}) {
  const lista = useMemo(() => {
    const out = coberturasUnicas(coberturas);
    for (const c of marcadas) if (!out.some((o) => o.ccobertura === c)) out.push({ ccobertura: c, nombre: `Cobertura ${c} (no está en el plan)` });
    return out;
  }, [coberturas, marcadas]);
  return (
    <fieldset className="space-y-1" aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="text-xs font-medium text-slate-700">
        Coberturas afectadas
        <InfoTip text={'Coberturas del plan a las que se aplica. Las demás cobran como siempre.\nEn Sis2000: campo «coberturas» del JSON'} />
      </legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {lista.map((c) => (
          <label key={c.ccobertura} className="inline-flex items-center gap-2 text-slate-600">
            <input
              type="checkbox"
              disabled={deshabilitado}
              checked={marcadas.includes(c.ccobertura)}
              onChange={(e) => onChange(e.target.checked ? [...marcadas, c.ccobertura] : marcadas.filter((m) => m !== c.ccobertura))}
            />
            {c.ccobertura} · {c.nombre}
          </label>
        ))}
      </div>
      {error && (
        <p id={`${id}-error`} className="text-[11px] text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  );
}

// ── Tasa diaria por tipo de vehículo ──────────────────────────────────────────

/**
 * Tasa diaria por tipo de vehículo (macatvalores PLAN_TASA_DIARIA): prima de cada cobertura marcada = suma asegurada ×
 * tasa % × días de vigencia. Manda sobre la tasa por antigüedad y la tasa del plan en esas coberturas (la antigüedad
 * sigue sirviendo de tope). Se muestra en la sección «Tarifa por días».
 */
export function TasaDiariaAuto({ planId, coberturas, soloLectura }: { planId: string; coberturas: Cobertura[]; soloLectura?: boolean }) {
  const cramo = Number(planId.split('-')[0]);
  const { dato, error, cargar } = useParametroAuto(planId, 'tasa-diaria');
  const esc = useEscritura();
  const [tipos, setTipos] = useState<Array<{ ctipo: string; xtipo: string }> | null>(null);
  const [errorTipos, setErrorTipos] = useState<ErrorEntendible | null>(null);
  const [form, setForm] = useState<TasaDiariaForm>(tasaDiariaDeConfig(null));
  const [intento, setIntento] = useState(false);
  const [motivo, setMotivo] = useState('');

  const cargarTipos = useCallback(() => {
    setErrorTipos(null);
    api
      .listarSis2000AutoTipos(cramo)
      .then((r) => setTipos(r.map((t) => ({ ctipo: String(t.ctipo ?? '').trim(), xtipo: String(t.xtipo ?? '').trim() })).filter((t) => t.ctipo !== '')))
      .catch((e) => {
        setTipos([]);
        setErrorTipos(entenderError(e, { titulo: 'No se pudieron leer los tipos de vehículo del ramo' }));
      });
  }, [cramo]);

  useEffect(() => {
    cargarTipos();
  }, [cargarTipos]);

  const original = useMemo(() => tasaDiariaDeConfig(dato?.config ?? null), [dato]);
  useEffect(() => {
    setForm(original);
    setIntento(false);
  }, [original]);

  const errores = intento ? validarTasaDiaria(form) : {};
  const cambio = JSON.stringify(form) !== JSON.stringify(original) || dato?.activo === false;
  const bloqueado = soloLectura || esc.trabajando || !dato || !dato.dominioCreado || dato.otroRamo != null;
  // Tipos guardados que ya no están en matipos (para no perderlos de vista).
  const filasTipo = useMemo(() => {
    const out = [...(tipos ?? [])];
    for (const k of Object.keys(form.tasas)) if (!out.some((t) => t.ctipo === k)) out.push({ ctipo: k, xtipo: '(no está en matipos del ramo)' });
    return out;
  }, [tipos, form.tasas]);

  function guardar() {
    setIntento(true);
    if (!sinErrores(validarTasaDiaria(form))) return;
    void esc.ejecutar(
      () => api.guardarSis2000AutoParametro(planId, 'tasa-diaria', { ...cuerpoTasaDiaria(form), motivoCambio: motivo || undefined }),
      {
        ok: 'Tasa diaria guardada y activa para el plan.',
        titulo: 'No se pudo guardar la tasa diaria',
        duplicado: TEXTO_409_AUTO,
        alTerminar: () => {
          setMotivo('');
          cargar();
        },
      },
    );
  }

  function desactivar() {
    if (!window.confirm('¿Desactivar la tasa diaria? El plan vuelve a cotizar con su tarifa normal. Lo guardado queda en Sis2000 (inactivo) y en el historial.')) return;
    void esc.ejecutar(() => api.desactivarSis2000AutoParametro(planId, 'tasa-diaria', motivo || undefined), {
      ok: 'Tasa diaria desactivada: el plan cotiza como siempre.',
      titulo: 'No se pudo desactivar la tasa diaria',
      duplicado: TEXTO_409_AUTO,
      alTerminar: () => {
        setMotivo('');
        cargar();
      },
    });
  }

  return (
    <SectionPanel
      title="Tasa diaria por tipo de vehículo"
      description="Para planes de auto que cobran por días (por ejemplo, alquiler). Prima de cada cobertura marcada = suma asegurada × tasa diaria % × días de vigencia. En esas coberturas manda sobre la tasa por antigüedad y la del plan; la antigüedad sigue sirviendo de tope."
      icon={Gauge}
    >
      <div className="space-y-4 text-xs">
        <AlertaError error={error} onReintentar={cargar} />
        <AlertaError error={errorTipos} onReintentar={cargarTipos} />
        <EstadoEscritura esc={esc} />
        {!dato ? (
          <p className="text-slate-500">Leyendo tasa diaria…</p>
        ) : (
          <>
            <EstadoParametro dato={dato} nombre="tasa diaria" />
            <CoberturasAfectadas
              id="tdiaria-cob"
              coberturas={coberturas}
              marcadas={form.coberturas}
              onChange={(c) => setForm({ ...form, coberturas: c })}
              error={errores.coberturas}
              deshabilitado={bloqueado}
            />
            <div className="overflow-x-auto">
              <table className="min-w-[420px] text-left">
                <thead className="text-slate-500">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Tipo de vehículo</th>
                    <th className="py-1 pr-3 font-medium">
                      Tasa diaria %
                      <InfoTip text={'% diario sobre la suma asegurada. Vacío = ese tipo no cotiza con tasa diaria (salvo que haya tasa por defecto). Ejemplo: 0,072.\nEn Sis2000: campo «tasas» del JSON, por matipos.ctipo'} />
                    </th>
                    <th className="py-1 font-medium">
                      Equivale a (anual)
                      <InfoTip text="Tasa diaria × 365. Solo es una ayuda para comparar: no se guarda ni se usa en el cálculo." />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tipos === null && (
                    <tr>
                      <td colSpan={3} className="py-1 text-slate-500">
                        Leyendo tipos de vehículo…
                      </td>
                    </tr>
                  )}
                  {filasTipo.map((t) => {
                    const valor = form.tasas[t.ctipo] ?? '';
                    const err = errores.porTipo?.[t.ctipo];
                    return (
                      <tr key={t.ctipo}>
                        <td className="py-1 pr-3 text-slate-700">
                          {t.ctipo} · {t.xtipo}
                        </td>
                        <td className="py-1 pr-3">
                          <Input
                            id={`tdiaria-tipo-${t.ctipo}`}
                            inputMode="decimal"
                            className="h-8 w-28"
                            value={valor}
                            disabled={bloqueado}
                            aria-invalid={err ? true : undefined}
                            onChange={(e) => setForm({ ...form, tasas: { ...form.tasas, [t.ctipo]: e.target.value } })}
                          />
                          {err && <p className="text-[11px] text-red-600">{err}</p>}
                        </td>
                        <td className="py-1 text-slate-500">{tasaAnualTexto(valor) ? `${tasaAnualTexto(valor)} %` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {errores.tasas && <p className="text-[11px] text-red-600">{errores.tasas}</p>}
            </div>
            <div className="flex flex-wrap gap-4">
              <div>
                <Label htmlFor="tdiaria-defecto">
                  Tasa por defecto %
                  <InfoTip text={'Para los tipos de vehículo sin tasa propia. Vacío = esos tipos no se pueden cotizar con este plan.\nEn Sis2000: tasa_defecto'} />
                </Label>
                <Input id="tdiaria-defecto" inputMode="decimal" className="h-9 w-28" value={form.tasa_defecto} disabled={bloqueado} onChange={(e) => setForm({ ...form, tasa_defecto: e.target.value })} />
                {tasaAnualTexto(form.tasa_defecto) && <p className="text-[11px] text-slate-500">Equivale a {tasaAnualTexto(form.tasa_defecto)} % anual</p>}
                {errores.tasa_defecto && <p className="text-[11px] text-red-600">{errores.tasa_defecto}</p>}
              </div>
              <div>
                <Label htmlFor="tdiaria-min">
                  Días mínimos
                  <InfoTip text={'Vigencia mínima en días (fecha hasta menos fecha desde). Fuera del rango el plan no cotiza.\nEn Sis2000: dias_min'} />
                </Label>
                <Input id="tdiaria-min" inputMode="numeric" className="h-9 w-24" value={form.dias_min} disabled={bloqueado} onChange={(e) => setForm({ ...form, dias_min: e.target.value })} />
                {errores.dias_min && <p className="text-[11px] text-red-600">{errores.dias_min}</p>}
              </div>
              <div>
                <Label htmlFor="tdiaria-max">
                  Días máximos
                  <InfoTip text={'Vigencia máxima en días (hasta 366).\nEn Sis2000: dias_max'} />
                </Label>
                <Input id="tdiaria-max" inputMode="numeric" className="h-9 w-24" value={form.dias_max} disabled={bloqueado} onChange={(e) => setForm({ ...form, dias_max: e.target.value })} />
                {errores.dias_max && <p className="text-[11px] text-red-600">{errores.dias_max}</p>}
              </div>
            </div>
            {!soloLectura && (
              <div className="flex flex-wrap items-end gap-3">
                <CampoMotivo id="tdiaria-motivo" valor={motivo} onChange={setMotivo} />
                <Button type="button" size="sm" onClick={guardar} disabled={bloqueado || !cambio}>
                  <Save className="h-3.5 w-3.5" />
                  Guardar tasa diaria
                </Button>
                {dato.existe && dato.activo && (
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
    </SectionPanel>
  );
}

// ── Descuento por deducible ───────────────────────────────────────────────────

const COLUMNAS_DEDUCIBLE: ColumnaEditable[] = [
  {
    clave: 'pdeducible',
    titulo: 'Deducible %',
    tipo: 'numero',
    ayuda: 'Deducible que puede elegir la póliza, en % (0 a 100). Ejemplo: 3.\nEn Sis2000: opciones[].pdeducible; queda en la póliza como deducible de la cobertura',
    ancho: 'w-28',
  },
  {
    clave: 'pdescuento',
    titulo: 'Descuento en la prima %',
    tipo: 'numero',
    ayuda: 'Descuento sobre la prima de las coberturas marcadas cuando se elige ese deducible (0 a 100). Ejemplo: 25.\nEn Sis2000: opciones[].pdescuento',
    ancho: 'w-28',
  },
];

/**
 * Descuento por deducible (macatvalores PLAN_DEDUCIBLE): al elegir un deducible de la tabla, la prima de las coberturas
 * marcadas baja en el % de descuento. Es distinto del deducible de la tarifa (arriba en «Deducibles»). Solo auto.
 */
export function DeducibleDescuentoAuto({ planId, coberturas }: { planId: string; coberturas: Cobertura[] }) {
  const { dato, error, cargar } = useParametroAuto(planId, 'deducibles');
  const esc = useEscritura();
  const [form, setForm] = useState<DeduciblesForm>(deduciblesDeConfig(null));
  const [intento, setIntento] = useState(false);
  const [motivo, setMotivo] = useState('');

  const original = useMemo(() => deduciblesDeConfig(dato?.config ?? null), [dato]);
  useEffect(() => {
    setForm(original);
    setIntento(false);
  }, [original]);

  const validacion = validarDeducibles(form);
  const cambio = JSON.stringify(form) !== JSON.stringify(original) || dato?.activo === false;
  const bloqueado = esc.trabajando || !dato || !dato.dominioCreado || dato.otroRamo != null;
  const filas: FilaTexto[] = form.opciones.map((o) => ({ ...o }));
  const columnas = COLUMNAS_DEDUCIBLE.map((c) => ({
    ...c,
    validar: (_: string, __: FilaTexto, i: number) => errorOpcionDeducible(form, i, c.clave as 'pdeducible' | 'pdescuento'),
  }));

  function guardar() {
    setIntento(true);
    if (!deduciblesValidos(validarDeducibles(form))) return;
    void esc.ejecutar(
      () => api.guardarSis2000AutoParametro(planId, 'deducibles', { ...cuerpoDeducibles(form), motivoCambio: motivo || undefined }),
      {
        ok: 'Opciones de deducible con descuento guardadas y activas para el plan.',
        titulo: 'No se pudieron guardar las opciones de deducible',
        duplicado: TEXTO_409_AUTO,
        alTerminar: () => {
          setMotivo('');
          cargar();
        },
      },
    );
  }

  function desactivar() {
    if (!window.confirm('¿Desactivar el descuento por deducible? El plan vuelve a cotizar sin descuento. Lo guardado queda en Sis2000 (inactivo) y en el historial.')) return;
    void esc.ejecutar(() => api.desactivarSis2000AutoParametro(planId, 'deducibles', motivo || undefined), {
      ok: 'Descuento por deducible desactivado: el plan cotiza sin descuento.',
      titulo: 'No se pudo desactivar el descuento por deducible',
      duplicado: TEXTO_409_AUTO,
      alTerminar: () => {
        setMotivo('');
        cargar();
      },
    });
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div>
        <p className="text-sm font-medium text-slate-800">Descuento por deducible (auto)</p>
        <p className="text-[11px] text-slate-500">
          Opciones de deducible que bajan la prima: al elegir uno, la prima de las coberturas marcadas baja en el % de descuento. El deducible elegido queda en la póliza.
        </p>
      </div>
      <AlertaError error={error} onReintentar={cargar} />
      <EstadoEscritura esc={esc} />
      {!dato ? (
        <p className="text-slate-500">Leyendo opciones de deducible…</p>
      ) : (
        <>
          <EstadoParametro dato={dato} nombre="descuento por deducible" />
          <CoberturasAfectadas
            id="dedauto-cob"
            coberturas={coberturas}
            marcadas={form.coberturas}
            onChange={(c) => setForm({ ...form, coberturas: c })}
            error={intento ? validacion.coberturas : undefined}
            deshabilitado={bloqueado}
          />
          <TablaEditable
            idBase="dedauto"
            columnas={columnas}
            filas={filas}
            onChange={(fs) => setForm({ ...form, opciones: fs.map((f) => ({ pdeducible: f.pdeducible ?? '', pdescuento: f.pdescuento ?? '' })) })}
            errores={validacion.filas}
            mostrarErrores={intento}
            filaNueva={() => ({ pdeducible: '', pdescuento: '' })}
            textoAgregar="Agregar opción de deducible"
            deshabilitada={bloqueado}
          />
          {intento && validacion.opciones && <p className="text-[11px] text-red-600">{validacion.opciones}</p>}
          <label className="inline-flex items-center gap-2 text-slate-600">
            <input type="checkbox" disabled={bloqueado} checked={form.obligatorio} onChange={(e) => setForm({ ...form, obligatorio: e.target.checked })} />
            Elegir un deducible es obligatorio para cotizar
            <InfoTip text={'Si está marcado, el plan no cotiza sin un deducible de la tabla. Si no, sin deducible no hay descuento.\nEn Sis2000: obligatorio'} />
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <CampoMotivo id="dedauto-motivo" valor={motivo} onChange={setMotivo} />
            <Button type="button" size="sm" onClick={guardar} disabled={bloqueado || !cambio}>
              <Save className="h-3.5 w-3.5" />
              Guardar opciones de deducible
            </Button>
            {dato.existe && dato.activo && (
              <Button type="button" size="sm" variant="outline" onClick={desactivar} disabled={bloqueado}>
                Desactivar
              </Button>
            )}
          </div>
        </>
      )}
      <DialogoConfirmarEscritura esc={esc} />
    </div>
  );
}
