import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Building2, Save } from 'lucide-react';
import { api } from '@/lib/api';
import {
  COLUMNAS_CONDOMINIO,
  cuerpoCondominio,
  filasCondominioATexto,
  listaDe,
  validarCondominio,
  type TablaCondominio,
} from '@/lib/configurador-fase2';
import { entenderError, type ErrorEntendible } from '@/lib/errores';
import { Alert } from '@/components/ui/alert';
import { AlertaError } from '@/components/ui/errores';
import { Button } from '@/components/ui/button';
import { SectionPanel } from '@/components/ui/section-panel';
import { cn } from '@/lib/utils';
import { TablaEditable, type ColumnaEditable, type FilaTexto } from './TablaEditable';
import { CampoMotivo, DialogoConfirmarEscritura, EstadoEscritura, useEscritura } from './EscrituraConfirmada';

const TABLAS: Array<{ id: TablaCondominio; titulo: string; resumen: string; tabla: string }> = [
  { id: 'antiguedad', titulo: 'Antigüedad', resumen: 'Tasa global según el año de construcción del inmueble y su uso (C o R). Un cambio afecta a todos los planes de condominio del ramo.', tabla: 'MATARIFA_ANTIGUEDAD_NEXUS' },
  { id: 'reparto', titulo: 'Reparto', resumen: 'Cómo se reparte la tasa global entre las coberturas: las de tipo P deben sumar 100; F es una parte fija y M un monto fijo.', tabla: 'MATARIFA_REPARTO_NEXUS' },
  { id: 'rango', titulo: 'Rango de tasas', resumen: 'Tasa mínima y máxima que se acepta al cotizar cada cobertura; fuera de ese rango la cotización se rechaza.', tabla: 'MATARIFA_RANGO_NEXUS' },
];

const filaVacia = (tabla: TablaCondominio): FilaTexto => Object.fromEntries(COLUMNAS_CONDOMINIO[tabla].map((c) => [c.clave, '']));

/**
 * Tarifa de condominio del ramo (patrimoniales): tres tablas que se editan por separado y se guardan reemplazando
 * todas las filas de esa tabla para el ramo. Son valores del ramo: afectan a todos sus planes.
 */
export function CondominioPanel({ cramo, soloLectura, onCambio }: { cramo: number; soloLectura?: boolean; onCambio?: () => void }) {
  const [tabla, setTabla] = useState<TablaCondominio>('antiguedad');
  return (
    <SectionPanel title="Tarifa de condominio" description="Tarifa de condominio del ramo: tasa por antigüedad del inmueble, reparto de esa tasa entre coberturas y rango permitido de tasa. Son valores del ramo: afectan a todos sus planes de condominio." icon={Building2}>
      <div className="space-y-4 text-xs">
        <div role="note" className="alert-banner border-amber-300 bg-amber-50 text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-bold">Estos valores son del ramo {cramo}: afectan a todos sus planes.</p>
        </div>
        {soloLectura && (
          <Alert variant="info">
            Por ahora la tarifa de condominio solo se consulta desde el configurador: guardarla todavía no está disponible
            en Sis2000 (se mantiene desde la pantalla de condominio de Nexus).
          </Alert>
        )}
        <nav aria-label="Tablas de condominio" className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {TABLAS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTabla(t.id)}
              aria-current={t.id === tabla ? 'page' : undefined}
              className={cn(
                'rounded-lg px-3 py-1.5 font-semibold',
                t.id === tabla ? 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200' : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              {t.titulo}
            </button>
          ))}
        </nav>
        <TablaCondominioEditor key={tabla} cramo={cramo} tabla={tabla} soloLectura={soloLectura} onCambio={onCambio} />
      </div>
    </SectionPanel>
  );
}

function TablaCondominioEditor({
  cramo,
  tabla,
  soloLectura,
  onCambio,
}: {
  cramo: number;
  tabla: TablaCondominio;
  soloLectura?: boolean;
  onCambio?: () => void;
}) {
  const info = TABLAS.find((t) => t.id === tabla)!;
  const esc = useEscritura();
  const [filas, setFilas] = useState<FilaTexto[] | null>(null);
  const [original, setOriginal] = useState<FilaTexto[]>([]);
  const [errorCarga, setErrorCarga] = useState<ErrorEntendible | null>(null);
  const [intento, setIntento] = useState(false);
  const [cargarNuevas, setCargarNuevas] = useState(false);
  const [motivo, setMotivo] = useState('');
  /** Avisos de nest-api al leer (tabla no disponible en esta base, ramo sin filas…). */
  const [avisosLectura, setAvisosLectura] = useState<string[]>([]);

  const cargar = useCallback(() => {
    setErrorCarga(null);
    api
      .leerSis2000Condominio(cramo, tabla)
      .then((r) => {
        const o = r && typeof r === 'object' && !Array.isArray(r) ? (r as { avisos?: unknown; disponible?: unknown }) : {};
        const avisos = Array.isArray(o.avisos) ? o.avisos.map(String).filter(Boolean) : [];
        if (o.disponible === false && !avisos.length) avisos.push('Esta tabla no existe en esta base de Sis2000.');
        setAvisosLectura(avisos);
        const t = filasCondominioATexto(tabla, listaDe(r));
        setFilas(t);
        setOriginal(t);
      })
      .catch((e) => {
        setFilas([]);
        setErrorCarga(entenderError(e, { titulo: `No se pudo leer la tabla de ${info.titulo.toLowerCase()}` }));
      });
  }, [cramo, tabla, info.titulo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const columnas: ColumnaEditable[] = COLUMNAS_CONDOMINIO[tabla].map((c) => ({
    clave: c.clave,
    titulo: c.titulo,
    ayuda: c.ayuda,
    tipo: c.tipo,
  }));
  const validacion = filas && intento ? validarCondominio(tabla, filas) : { filas: [], tabla: null };
  const cambio = filas !== null && JSON.stringify(filas) !== JSON.stringify(original);

  function guardar() {
    if (!filas) return;
    setIntento(true);
    const v = validarCondominio(tabla, filas);
    if (v.tabla || v.filas.some((e) => Object.keys(e).length)) return;
    void esc.ejecutar(
      (confirmar) =>
        api.guardarSis2000Condominio(cramo, tabla, {
          ...cuerpoCondominio(tabla, filas),
          motivoCambio: motivo || undefined,
          ...(confirmar ? { confirmar: true } : {}),
        }),
      {
        ok: `Tabla de ${info.titulo.toLowerCase()} guardada (${filas.length} fila${filas.length === 1 ? '' : 's'}).`,
        titulo: `No se pudo guardar la tabla de ${info.titulo.toLowerCase()}`,
        noImplementado: 'Guardar la tarifa de condominio todavía no está disponible en Sis2000: por ahora solo se consulta.',
        alTerminar: () => {
          setIntento(false);
          setMotivo('');
          setCargarNuevas(false);
          cargar();
          onCambio?.();
        },
      },
    );
  }

  if (filas === null) return <p className="text-slate-500">Leyendo…</p>;
  const vacia = original.length === 0 && !cargarNuevas;

  return (
    <div className="space-y-3">
      <p className="text-slate-600">{info.resumen}</p>
      <AlertaError error={errorCarga} onReintentar={cargar} />
      {avisosLectura.length > 0 && (
        <Alert variant="warning">
          <ul className="list-disc space-y-0.5 pl-4">
            {avisosLectura.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </Alert>
      )}
      <EstadoEscritura esc={esc} />
      {vacia && !errorCarga ? (
        <div className="space-y-2">
          <Alert variant="info">Este ramo no usa la tarifa de condominio en esta tabla (no tiene filas).</Alert>
          {!soloLectura && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCargarNuevas(true);
                setFilas([filaVacia(tabla)]);
              }}
            >
              Cargar filas
            </Button>
          )}
        </div>
      ) : (
        <>
          <TablaEditable
            idBase={`condominio-${tabla}`}
            columnas={columnas}
            filas={filas}
            onChange={setFilas}
            errores={validacion.filas}
            mostrarErrores={intento}
            filaNueva={soloLectura ? undefined : () => filaVacia(tabla)}
            puedeQuitar={!soloLectura}
            deshabilitada={soloLectura || esc.trabajando}
          />
          {validacion.tabla && <Alert variant="error">{validacion.tabla}</Alert>}
          {!soloLectura && (
            <div className="flex flex-wrap items-end gap-3">
              <CampoMotivo id={`condominio-${tabla}-motivo`} valor={motivo} onChange={setMotivo} />
              <Button type="button" size="sm" onClick={guardar} disabled={esc.trabajando || !cambio}>
                <Save className="h-3.5 w-3.5" />
                Guardar tabla
              </Button>
              {cambio && (
                <Button type="button" size="sm" variant="outline" disabled={esc.trabajando} onClick={() => { setFilas(original); setIntento(false); setCargarNuevas(false); }}>
                  Descartar cambios
                </Button>
              )}
              <p className="w-full text-[11px] text-slate-500">Guardar reemplaza todas las filas de esta tabla para el ramo.</p>
            </div>
          )}
        </>
      )}
      <DialogoConfirmarEscritura esc={esc} contexto="Sis2000 avisa lo siguiente. Si guardas, el cambio aplica a todos los planes del ramo:" />
    </div>
  );
}
