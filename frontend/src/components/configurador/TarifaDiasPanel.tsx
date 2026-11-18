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
  { clave: 'ctarifabi', titulo: 'Tarifa binacional', tipo: 'entero', ayuda: 'Código de la tarifa binacional (ctarifabi).', ancho: 'w-24' },
  { clave: 'qdias', titulo: 'Tramo', tipo: 'entero', ayuda: 'Número de tramo de la fila (qdias, parte de la llave).', ancho: 'w-16' },
  {
    clave: 'bnacional',
    titulo: 'Ámbito',
    tipo: 'select',
    ayuda: 'Nacional o internacional (bnacional).',
    opciones: [
      { valor: '', etiqueta: 'Elige…' },
      { valor: '1', etiqueta: 'Nacional' },
      { valor: '0', etiqueta: 'Internacional' },
    ],
    ancho: 'w-32',
  },
  { clave: 'cmoneda', titulo: 'Moneda', ayuda: 'Código de moneda (cmoneda), p. ej. $.', ancho: 'w-16' },
  { clave: 'ndias_min', titulo: 'Días mín.', tipo: 'entero', ayuda: 'Desde cuántos días aplica (ndias_min).', ancho: 'w-20' },
  { clave: 'ndias_max', titulo: 'Días máx.', tipo: 'entero', ayuda: 'Hasta cuántos días aplica (ndias_max). 30 con prima anual = fila anual. Un borde compartido (0–3 y 3–7) es válido.', ancho: 'w-20' },
  { clave: 'msuma', titulo: 'Suma', tipo: 'numero', ayuda: 'Suma asegurada (msuma).' },
  { clave: 'mprima', titulo: 'Prima', tipo: 'numero', ayuda: 'Prima del rango (mprima).' },
  { clave: 'mprima_anual', titulo: 'Prima anual', tipo: 'numero', ayuda: 'Prima anual (mprima_anual); obligatoria en la fila de 30 días de los planes Binacional.' },
  { clave: 'mprima_dia', titulo: 'Prima por día', tipo: 'numero', ayuda: 'Prima diaria (mprima_dia).' },
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
    <SectionPanel title="Tarifa por días" description="Prima según los días de viaje, por cobertura (planes Binacional)." icon={CalendarDays}>
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
