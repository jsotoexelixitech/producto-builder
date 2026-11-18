import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Save } from 'lucide-react';
import { api } from '@/lib/api';
import {
  COLUMNAS_TARIFA_DIAS,
  cuerpoTarifaDias,
  listaDe,
  normalizarTarifaDias,
  validarTarifaDias,
  type FilaTarifaDias,
} from '@/lib/configurador-fase2';
import { entenderError, type ErrorEntendible } from '@/lib/errores';
import { Alert } from '@/components/ui/alert';
import { AlertaError } from '@/components/ui/errores';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SectionPanel } from '@/components/ui/section-panel';
import { TablaEditable, type ColumnaEditable, type FilaTexto } from './TablaEditable';
import { CampoMotivo, DialogoConfirmarEscritura, EstadoEscritura, useEscritura } from './EscrituraConfirmada';

type FilaLeida = ReturnType<typeof normalizarTarifaDias>;
const clave = (cc: string, ct: string) => `${cc.trim().toUpperCase()}|${ct.trim().toUpperCase()}`;

const COLUMNAS: ColumnaEditable[] = [
  { clave: 'ctarifabi', titulo: 'Tarifa binacional', tipo: 'entero', ayuda: 'Grupo de tarifa binacional. La cotización elige el grupo según los parámetros del Binacional (tarifa normal o de riesgo por actividad) o, si no hay parámetros, según el modelo del vehículo.\nEn Sis2000: maplantar_dias.ctarifabi', ancho: 'w-24' },
  { clave: 'qdias', titulo: 'Tramo', tipo: 'entero', ayuda: 'Número de la fila dentro de la tarifa; forma parte de la llave. La cotización no busca por este dato.\nEn Sis2000: maplantar_dias.qdias', ancho: 'w-16' },
  {
    clave: 'bnacional',
    titulo: 'Ámbito',
    tipo: 'select',
    ayuda: 'Nacional o internacional. Hoy la cotización de Nexus no filtra por este dato.\nEn Sis2000: maplantar_dias.bnacional',
    opciones: [
      { valor: '', etiqueta: 'Elige…' },
      { valor: '1', etiqueta: 'Nacional' },
      { valor: '0', etiqueta: 'Internacional' },
    ],
    ancho: 'w-32',
  },
  { clave: 'cmoneda', titulo: 'Moneda', ayuda: 'Moneda de los montos de la fila. Ejemplo: $. La cotización toma la moneda de la cobertura.\nEn Sis2000: maplantar_dias.cmoneda', ancho: 'w-16' },
  { clave: 'ndias_min', titulo: 'Días mín.', tipo: 'entero', ayuda: 'Desde cuántos días aplica la fila. Es referencial: la cotización busca por los días máximos.\nEn Sis2000: maplantar_dias.ndias_min', ancho: 'w-20' },
  { clave: 'ndias_max', titulo: 'Días máx.', tipo: 'entero', ayuda: 'La cotización toma la fila cuyo valor es igual a los días de vigencia. 30 = fila anual: se usa con vigencia de 12 meses y cobra la prima anual. Un borde compartido (0–3 y 3–7) es válido.\nEn Sis2000: maplantar_dias.ndias_max', ancho: 'w-20' },
  { clave: 'msuma', titulo: 'Suma', tipo: 'numero', ayuda: 'Suma asegurada de la cobertura para esta fila; la cotización la toma de aquí.\nEn Sis2000: maplantar_dias.msuma' },
  { clave: 'mprima', titulo: 'Prima', tipo: 'numero', ayuda: 'Prima por los días de esta fila (vigencias menores a un año).\nEn Sis2000: maplantar_dias.mprima' },
  { clave: 'mprima_anual', titulo: 'Prima anual', tipo: 'numero', ayuda: 'Prima cuando la vigencia es de 12 meses. Obligatoria en la fila de 30 días de los planes Binacional: con los parámetros del Binacional activos solo se emite anual.\nEn Sis2000: maplantar_dias.mprima_anual' },
  { clave: 'mprima_dia', titulo: 'Prima por día', tipo: 'numero', ayuda: 'Prima por cada día que pase del máximo de días de la tabla; se suma a la prima de la fila de 30.\nEn Sis2000: maplantar_dias.mprima_dia' },
];

const filaVacia = (anterior?: FilaTexto): FilaTexto => {
  const f = Object.fromEntries(COLUMNAS_TARIFA_DIAS.map((k) => [k, ''])) as FilaTexto;
  if (anterior) {
    f.ctarifabi = anterior.ctarifabi ?? '';
    f.bnacional = anterior.bnacional ?? '';
    f.cmoneda = anterior.cmoneda ?? '';
    if (/^\d+$/.test(anterior.ndias_max ?? '')) f.ndias_min = String(Number(anterior.ndias_max) + 1);
  }
  return f;
};

/**
 * Tarifa por días (auto, Binacional): prima según los días de viaje, por cobertura y tarifa del plan. Guardar
 * reemplaza las filas vigentes de esa cobertura y tarifa. Los rangos de días no pueden solaparse y los planes
 * Binacional necesitan la fila anual (30 días con prima anual).
 */
export function TarifaDiasPanel({
  planId,
  cplan,
  coberturas,
  soloLectura,
  onCambio,
}: {
  planId: string;
  cplan: string;
  coberturas: Array<{ ccobertura: string; ctarifa: string; nombre: string }>;
  soloLectura?: boolean;
  onCambio?: () => void;
}) {
  const esc = useEscritura();
  const [leidas, setLeidas] = useState<FilaLeida[] | null>(null);
  const [errorCarga, setErrorCarga] = useState<ErrorEntendible | null>(null);
  const [elegida, setElegida] = useState('');
  const [filas, setFilas] = useState<FilaTexto[]>([]);
  const [intento, setIntento] = useState(false);
  const [motivo, setMotivo] = useState('');

  const cargar = useCallback(() => {
    setErrorCarga(null);
    api
      .listarSis2000TarifaDias(planId)
      .then((r) => setLeidas(listaDe(r).map(normalizarTarifaDias)))
      .catch((e) => {
        setLeidas([]);
        setErrorCarga(entenderError(e, { titulo: 'No se pudo leer la tarifa por días del plan' }));
      });
  }, [planId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /** Coberturas del plan + las que ya tienen filas por días (aunque no estén en la lista del plan). */
  const opciones = useMemo(() => {
    const out = new Map<string, { ccobertura: string; ctarifa: string; nombre: string; filas: number }>();
    for (const c of coberturas) out.set(clave(c.ccobertura, c.ctarifa), { ...c, filas: 0 });
    for (const f of leidas ?? []) {
      if (f.iestado !== 'V') continue;
      const k = clave(f.ccober, f.ctarifa);
      const actual = out.get(k) ?? { ccobertura: f.ccober, ctarifa: f.ctarifa, nombre: `Cobertura ${f.ccober}`, filas: 0 };
      out.set(k, { ...actual, filas: actual.filas + 1 });
    }
    return [...out.entries()];
  }, [coberturas, leidas]);

  // Al leer, se elige la primera cobertura con filas (o la primera del plan).
  useEffect(() => {
    if (elegida || !leidas) return;
    const conFilas = opciones.find(([, o]) => o.filas > 0) ?? opciones[0];
    if (conFilas) setElegida(conFilas[0]);
  }, [opciones, leidas, elegida]);

  const originales = useMemo(
    () =>
      (leidas ?? [])
        .filter((f) => f.iestado === 'V' && clave(f.ccober, f.ctarifa) === elegida)
        .map((f) => Object.fromEntries(COLUMNAS_TARIFA_DIAS.map((k) => [k, f[k]])) as FilaTexto)
        .sort((a, b) => (a.ctarifabi + a.bnacional).localeCompare(b.ctarifabi + b.bnacional) || Number(a.ndias_min) - Number(b.ndias_min)),
    [leidas, elegida],
  );

  useEffect(() => {
    setFilas(originales);
    setIntento(false);
  }, [originales]);

  const sel = opciones.find(([k]) => k === elegida)?.[1];
  const validacion = intento ? validarTarifaDias(filas as FilaTarifaDias[], cplan) : { filas: [], tabla: [] as string[] };
  const cambio = JSON.stringify(filas) !== JSON.stringify(originales);

  function guardar() {
    if (!sel) return;
    setIntento(true);
    const v = validarTarifaDias(filas as FilaTarifaDias[], cplan);
    if (v.tabla.length || v.filas.some((e) => Object.keys(e).length)) return;
    void esc.ejecutar(
      (confirmar) =>
        api.guardarSis2000TarifaDias(planId, sel.ccobertura, sel.ctarifa, {
          ...cuerpoTarifaDias(filas as FilaTarifaDias[]),
          motivoCambio: motivo || undefined,
          ...(confirmar ? { confirmar: true } : {}),
        }),
      {
        ok: `Tarifa por días de ${sel.nombre} guardada (${filas.length} fila${filas.length === 1 ? '' : 's'}).`,
        titulo: 'No se pudo guardar la tarifa por días',
        alTerminar: () => {
          setMotivo('');
          cargar();
          onCambio?.();
        },
      },
    );
  }

  return (
    <SectionPanel title="Tarifa por días" description="Prima según los días de vigencia, por cobertura (planes Binacional, placa B). Ojo: la cotización no mira si la fila está activa, así que una fila inactiva con los mismos días y grupo de tarifa todavía puede tomarse." icon={CalendarDays}>
      <div className="space-y-4 text-xs">
        <AlertaError error={errorCarga} onReintentar={cargar} />
        <EstadoEscritura esc={esc} />
        {leidas === null ? (
          <p className="text-slate-500">Leyendo tarifa por días…</p>
        ) : opciones.length === 0 ? (
          <Alert variant="info">El plan no tiene coberturas para cargar tarifa por días.</Alert>
        ) : (
          <>
            <div className="max-w-md">
              <Label htmlFor="tdias-cob">Cobertura y tarifa</Label>
              <select
                id="tdias-cob"
                className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={elegida}
                onChange={(e) => setElegida(e.target.value)}
              >
                {opciones.map(([k, o]) => (
                  <option key={k} value={k}>
                    {o.nombre} ({o.ccobertura} · tarifa {o.ctarifa}){o.filas ? ` · ${o.filas} fila${o.filas === 1 ? '' : 's'}` : ' · sin filas'}
                  </option>
                ))}
              </select>
            </div>
            {originales.length === 0 && <Alert variant="info">Esta cobertura no tiene tarifa por días: cobra con la tarifa normal del plan.</Alert>}
            <TablaEditable
              idBase="tdias"
              columnas={COLUMNAS}
              filas={filas}
              onChange={setFilas}
              errores={validacion.filas}
              mostrarErrores={intento}
              filaNueva={soloLectura ? undefined : (fs) => filaVacia(fs[fs.length - 1])}
              textoAgregar="Agregar rango de días"
              puedeQuitar={!soloLectura}
              deshabilitada={soloLectura || esc.trabajando}
            />
            {validacion.tabla.length > 0 && (
              <Alert variant="error">
                <ul className="list-disc space-y-0.5 pl-4">
                  {validacion.tabla.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </Alert>
            )}
            {!soloLectura && (
              <div className="flex flex-wrap items-end gap-3">
                <CampoMotivo id="tdias-motivo" valor={motivo} onChange={setMotivo} />
                <Button type="button" size="sm" onClick={guardar} disabled={esc.trabajando || !cambio}>
                  <Save className="h-3.5 w-3.5" />
                  Guardar tarifa por días
                </Button>
                {cambio && (
                  <Button type="button" size="sm" variant="outline" disabled={esc.trabajando} onClick={() => setFilas(originales)}>
                    Descartar cambios
                  </Button>
                )}
                <p className="w-full text-[11px] text-slate-500">
                  Guardar reemplaza todas las filas vigentes de esta cobertura y tarifa por las de la tabla (las anteriores quedan inactivas).
                </p>
              </div>
            )}
          </>
        )}
        <DialogoConfirmarEscritura esc={esc} />
      </div>
    </SectionPanel>
  );
}
