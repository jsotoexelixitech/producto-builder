import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardPaste, Copy, Plus, Trash2, Wand2, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import {
  generarTramos,
  leerNumero,
  leerPegado,
  TRAMOS_ESTANDAR,
  tramosPorAncho,
  traducirErrorSis2000,
  type TramoTexto,
} from '@/lib/sis2000-tramos';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField, FormGrid } from '@/components/ui/form-field';
import { InfoTip } from '@/components/ui/info-tip';
import { Input } from '@/components/ui/input';

/** Tramo de mapltabedad_d tal como lo pide nest-api (TramoEdadDto). */
export interface TramoEdad {
  nedad_min: number;
  nedad_max: number;
  /** Tasa en % sobre la suma asegurada (0,449 % = 4,49 ‰). */
  pprima: number;
  /** Prima fija del tramo. */
  mprima?: number;
  msuma?: number;
  msumamax?: number;
}

/** Tabla de tasas por edad (mapltabedad) con sus tramos y los planes que la usan. */
export interface TablaEdad {
  ctablaedad: string;
  xtablaedad: string;
  iaplica_tabedad?: string;
  tramos: TramoEdad[];
  usada_por?: Array<{ cramo: number; cplan: string; ccobertura: string }>;
}

/** Fila del buscador de tablas (GET tablas-edad?q=). */
export interface TablaEdadResumen {
  ctablaedad: string;
  xtablaedad: string;
  ntramos: number;
  nedad_min: number | null;
  nedad_max: number | null;
}

type FilaTramo = TramoTexto;

type ColumnasPegado = 'prima' | 'tasa' | 'suma-prima' | 'suma-tasa';

const COLUMNAS_PEGADO: Array<{ valor: ColumnasPegado; etiqueta: string }> = [
  { valor: 'prima', etiqueta: 'Edad mín · Edad máx · Prima' },
  { valor: 'tasa', etiqueta: 'Edad mín · Edad máx · Tasa %' },
  { valor: 'suma-prima', etiqueta: 'Edad mín · Edad máx · Suma · Prima' },
  { valor: 'suma-tasa', etiqueta: 'Edad mín · Edad máx · Suma · Tasa %' },
];

const LARGO_CODIGO = 10;
const LARGO_DESCRIPCION = 60;
const EDAD_TOPE = 120;
const TRAMO_INICIAL: FilaTramo = { desde: '0', hasta: '74', tasa: '', prima: '' };

const aNumero = (v: string) => (v.trim() === '' ? 0 : Number(v.trim().replace(',', '.')));
const esEntero = (v: string) => /^\d+$/.test(v.trim());
const decimales = (v: string) => (v.trim().replace(',', '.').split('.')[1] ?? '').length;

/** Mismas reglas que nest-api (validarTramos), para avisar antes de enviar. */
function validar(codigo: string, descripcion: string, filas: FilaTramo[]): string[] {
  const errores: string[] = [];
  if (!codigo.trim()) errores.push('Falta el código de la tabla.');
  else if (!/^[A-Z0-9_-]+$/.test(codigo.trim())) errores.push('El código solo admite letras, números, guion y guion bajo.');
  if (!descripcion.trim()) errores.push('Falta la descripción de la tabla.');
  if (!filas.length) errores.push('Agrega al menos un tramo de edad.');

  filas.forEach((f, i) => {
    const n = `Tramo ${i + 1}`;
    if (!esEntero(f.desde) || !esEntero(f.hasta)) {
      errores.push(`${n}: las edades deben ser números enteros.`);
      return;
    }
    const desde = Number(f.desde);
    const hasta = Number(f.hasta);
    if (hasta > EDAD_TOPE) errores.push(`${n}: la edad máxima no puede pasar de ${EDAD_TOPE}.`);
    if (desde > hasta) errores.push(`${n}: «Edad desde» es mayor que «Edad hasta».`);
    const tasa = aNumero(f.tasa);
    const prima = aNumero(f.prima);
    if (Number.isNaN(tasa) || Number.isNaN(prima) || tasa < 0 || prima < 0) {
      errores.push(`${n}: la tasa y la prima deben ser números positivos.`);
    } else if (!(tasa > 0) && !(prima > 0)) {
      errores.push(`${n}: indica la tasa (%) o la prima fija, mayor a 0.`);
    }
    if (decimales(f.tasa) > 6) errores.push(`${n}: la tasa admite hasta 6 decimales.`);
    if (decimales(f.prima) > 2) errores.push(`${n}: Sis2000 guarda la prima fija con 2 decimales (redondearía ${f.prima}). Use 2 decimales o cobre con Tasa (%), que admite 6.`);
  });

  const orden = filas
    .filter((f) => esEntero(f.desde) && esEntero(f.hasta))
    .map((f) => ({ desde: Number(f.desde), hasta: Number(f.hasta) }))
    .sort((a, b) => a.desde - b.desde);
  orden.forEach((t, i) => {
    const previo = orden[i - 1];
    if (previo && t.desde <= previo.hasta) {
      errores.push(`El tramo ${t.desde}-${t.hasta} se solapa con el tramo ${previo.desde}-${previo.hasta}.`);
    }
  });
  return errores;
}

const formato = (v: unknown, max = 6) =>
  Number(v ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: max });

interface Props {
  modo: 'crear' | 'ver';
  /** Crear: código sugerido. Ver: código de la tabla a consultar. */
  codigo: string;
  /** Crear: descripción sugerida. */
  descripcion?: string;
  onClose: () => void;
  /** Crear: la tabla quedó guardada en Sis2000 con este código. */
  onCreada?: (codigo: string) => void;
  /** Crear: el código ya existe y el usuario prefiere usar esa tabla (si falta, se usa onCreada). */
  onUsarExistente?: (codigo: string) => void;
  /** Crear: tramos con los que arranca el formulario (p. ej. el rango de edades del plan). */
  tramosIniciales?: TramoTexto[];
}

/** Estado de la verificación del código antes de crear. */
type EstadoCodigo = 'vacio' | 'verificando' | 'libre' | 'existe' | 'sin-verificar';

/**
 * Tabla de precios por edad de un plan de personas (mapltabedad + mapltabedad_d). «Crear» guarda cabecera y tramos en
 * una sola llamada; «Ver» solo consulta.
 */
export function TablaEdadDialog({
  modo,
  codigo: codigoInicial,
  descripcion: descripcionInicial = '',
  onClose,
  onCreada,
  onUsarExistente,
  tramosIniciales,
}: Props) {
  const [codigo, setCodigo] = useState(codigoInicial.trim().toUpperCase().slice(0, LARGO_CODIGO));
  const [descripcion, setDescripcion] = useState(descripcionInicial.trim().slice(0, LARGO_DESCRIPCION));
  const [filas, setFilas] = useState<FilaTramo[]>(tramosIniciales?.length ? tramosIniciales : [TRAMO_INICIAL]);

  // Verificación del código: si ya existe en Sis2000 no se deja crear (se ofrece usar la existente).
  const [estadoCodigo, setEstadoCodigo] = useState<EstadoCodigo>('vacio');
  const [existente, setExistente] = useState<TablaEdad | null>(null);

  // Carga rápida de tramos.
  const [rapido, setRapido] = useState<'estandar' | 'ancho' | 'unica' | 'pegar' | 'copiar' | null>(null);
  const [anchoDesde, setAnchoDesde] = useState('0');
  const [anchoHasta, setAnchoHasta] = useState('74');
  const [ancho, setAncho] = useState('5');
  const [precioUnico, setPrecioUnico] = useState('');
  const [precioUnicoEs, setPrecioUnicoEs] = useState<'prima' | 'tasa'>('prima');
  const [textoPegado, setTextoPegado] = useState('');
  const [columnasPegado, setColumnasPegado] = useState<ColumnasPegado>('prima');
  const [codigoCopiar, setCodigoCopiar] = useState('');
  const [copiando, setCopiando] = useState(false);
  const [avisoRapido, setAvisoRapido] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  useEffect(() => {
    if (modo !== 'crear') return;
    const cod = codigo.trim().toUpperCase();
    if (!cod) {
      setEstadoCodigo('vacio');
      setExistente(null);
      return;
    }
    let vigente = true;
    setEstadoCodigo('verificando');
    const t = setTimeout(() => {
      api
        .leerSis2000TablaEdad(cod)
        .then((tab) => {
          if (!vigente) return;
          setExistente(tab);
          setEstadoCodigo('existe');
        })
        .catch((e: unknown) => {
          if (!vigente) return;
          setExistente(null);
          // 404 = el código está libre; otro error = no se pudo verificar (nest-api igual rechaza duplicados).
          setEstadoCodigo(e instanceof ApiError && e.status === 404 ? 'libre' : 'sin-verificar');
        });
    }, 400);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [modo, codigo]);

  function aplicarRapido(nuevas: FilaTramo[], texto: string) {
    if (!nuevas.length) {
      setAvisoRapido({ tipo: 'error', texto: 'No se generó ningún tramo: revisa los datos.' });
      return;
    }
    setFilas(nuevas);
    setAvisoRapido({ tipo: 'ok', texto });
    setRapido(null);
  }

  /** Pone la misma prima (o tasa) en todos los tramos ya escritos; si no hay tramos con edades, crea uno 0–74. */
  function aplicarPrecioUnico() {
    const valor = leerNumero(precioUnico);
    if (!valor || !(Number(valor) > 0)) {
      setAvisoRapido({ tipo: 'error', texto: 'Escribe un monto mayor a 0.' });
      return;
    }
    const base = filas.some((f) => esEntero(f.desde) && esEntero(f.hasta)) ? filas : [TRAMO_INICIAL];
    aplicarRapido(
      base.map((f) => ({ ...f, prima: precioUnicoEs === 'prima' ? valor : '', tasa: precioUnicoEs === 'tasa' ? valor : '' })),
      `Misma ${precioUnicoEs === 'prima' ? 'prima' : 'tasa'} (${valor}) en ${base.length} tramo${base.length === 1 ? '' : 's'}.`,
    );
  }

  function aplicarPegado() {
    const r = leerPegado(textoPegado, columnasPegado);
    if (!r.tramos.length) {
      setAvisoRapido({
        tipo: 'error',
        texto: 'No se reconoció ninguna fila. Copia de Excel las columnas en el orden indicado (edad mínima, edad máxima, …).',
      });
      return;
    }
    aplicarRapido(
      r.tramos,
      `Se cargaron ${r.tramos.length} tramo${r.tramos.length === 1 ? '' : 's'}${r.ignoradas.length ? `; se ignoraron ${r.ignoradas.length} fila(s) que no se pudieron leer (${r.ignoradas.slice(0, 3).join(' · ')})` : ''}.`,
    );
  }

  async function copiarDeOtra() {
    const cod = codigoCopiar.trim().toUpperCase();
    if (!cod) return;
    setCopiando(true);
    setAvisoRapido(null);
    try {
      const t = await api.leerSis2000TablaEdad(cod);
      const tramos = (t.tramos ?? []).map((x) => ({
        desde: String(x.nedad_min),
        hasta: String(x.nedad_max),
        tasa: Number(x.pprima) > 0 ? String(Number(x.pprima)) : '',
        prima: Number(x.mprima) > 0 ? String(Number(x.mprima)) : '',
      }));
      if (!tramos.length) {
        setAvisoRapido({ tipo: 'error', texto: `La tabla ${cod} no tiene tramos para copiar.` });
        return;
      }
      aplicarRapido(tramos, `Se copiaron ${tramos.length} tramos de la tabla ${cod}. Ajusta lo que cambie y guarda con el código nuevo.`);
    } catch (e) {
      setAvisoRapido({
        tipo: 'error',
        texto: e instanceof ApiError && e.status === 404 ? `No existe la tabla ${cod}.` : traducirErrorSis2000(e instanceof Error ? e.message : ''),
      });
    } finally {
      setCopiando(false);
    }
  }
  const [intento, setIntento] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tabla, setTabla] = useState<TablaEdad | null>(null);
  const [cargando, setCargando] = useState(modo === 'ver');

  useEffect(() => {
    if (modo !== 'ver') return;
    let vigente = true;
    setCargando(true);
    setError(null);
    api
      .leerSis2000TablaEdad(codigoInicial)
      .then((t) => vigente && setTabla(t))
      .catch((e: unknown) => vigente && setError(e instanceof Error ? e.message : 'No se pudo consultar la tabla.'))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [modo, codigoInicial]);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !guardando) onClose();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [guardando, onClose]);

  const errores = modo === 'crear' ? validar(codigo, descripcion, filas) : [];
  if (modo === 'crear' && estadoCodigo === 'existe') {
    errores.unshift(`Ya existe una tabla con el código ${codigo.trim().toUpperCase()}: úsala o cambia el código.`);
  }

  function usarExistente() {
    const cod = codigo.trim().toUpperCase();
    (onUsarExistente ?? onCreada)?.(cod);
    onClose();
  }

  function cambiarFila(i: number, cambios: Partial<FilaTramo>) {
    setFilas((prev) => prev.map((f, j) => (j === i ? { ...f, ...cambios } : f)));
  }

  function agregarTramo() {
    setFilas((prev) => {
      const ultimo = prev[prev.length - 1];
      const desde = ultimo && esEntero(ultimo.hasta) ? String(Number(ultimo.hasta) + 1) : '';
      return [...prev, { desde, hasta: '', tasa: '', prima: '' }];
    });
  }

  async function guardar() {
    setIntento(true);
    setError(null);
    if (errores.length) return;
    const cod = codigo.trim().toUpperCase();
    setGuardando(true);
    try {
      await api.crearSis2000TablaEdad({
        ctablaedad: cod,
        xtablaedad: descripcion.trim(),
        tramos: filas.map((f) => ({
          nedad_min: Number(f.desde),
          nedad_max: Number(f.hasta),
          pprima: aNumero(f.tasa),
          mprima: aNumero(f.prima),
        })),
      });
      onCreada?.(cod);
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setEstadoCodigo('existe');
        setError(`Ya existe una tabla con el código ${cod} en Sis2000. Úsala con «Usar la existente» o cambia el código.`);
      } else {
        setError(traducirErrorSis2000(e instanceof Error ? e.message : 'No se pudo crear la tabla.'));
      }
    } finally {
      setGuardando(false);
    }
  }

  const titulo = modo === 'crear' ? 'Crear tabla de precios por edad' : `Tabla de precios por edad ${codigoInicial.trim().toUpperCase()}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-2xl sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">{titulo}</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {modo === 'crear'
                ? 'Define cuánto se cobra según la edad del asegurado. Se guarda en Sis2000 (mapltabedad) y queda disponible para este y otros planes de personas.'
                : 'Solo consulta: así está la tabla en Sis2000.'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            disabled={guardando}
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <Alert variant="error" className="mb-3">
            {error}
          </Alert>
        )}

        {modo === 'ver' ? (
          cargando ? (
            <p className="py-6 text-center text-sm text-slate-500">Consultando la tabla…</p>
          ) : tabla ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-700">
                <span className="font-bold">{tabla.ctablaedad}</span> · {tabla.xtablaedad || 'Sin descripción'}
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Edad desde</th>
                      <th className="px-3 py-2">Edad hasta</th>
                      <th className="px-3 py-2">Tasa (%)</th>
                      <th className="px-3 py-2">Prima fija</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tabla.tramos ?? []).map((t) => (
                      <tr key={`${t.nedad_min}-${t.nedad_max}`} className="border-t border-slate-100">
                        <td className="px-3 py-1.5">{t.nedad_min}</td>
                        <td className="px-3 py-1.5">{t.nedad_max}</td>
                        <td className="px-3 py-1.5">{formato(t.pprima)}</td>
                        <td className="px-3 py-1.5">{formato(t.mprima, 6)}</td>
                      </tr>
                    ))}
                    {!(tabla.tramos ?? []).length && (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                          La tabla existe pero no tiene tramos: no se puede usar en un plan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">
                {(tabla.usada_por ?? []).length
                  ? `La usan: ${(tabla.usada_por ?? [])
                      .map((p) => `plan ${p.cplan} (ramo ${p.cramo}, cobertura ${p.ccobertura})`)
                      .join(' · ')}.`
                  : 'Ningún plan la usa todavía.'}
              </p>
            </div>
          ) : null
        ) : (
          <div className="space-y-4">
            <FormGrid>
              <FormField
                label="Código de la tabla"
                htmlFor="tabla-edad-codigo"
                hint={`Máx. ${LARGO_CODIGO} caracteres, en mayúsculas. No puede repetirse.`}
                tooltip="Nombre corto con el que el plan encuentra esta tabla (mapltabedad.ctablaedad). Es lo que queda escrito en el campo «Tabla de tasas»."
              >
                <Input
                  id="tabla-edad-codigo"
                  value={codigo}
                  maxLength={LARGO_CODIGO}
                  disabled={guardando}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                />
              </FormField>
              <FormField
                label="Descripción"
                htmlFor="tabla-edad-descripcion"
                hint={`Máx. ${LARGO_DESCRIPCION} caracteres.`}
                tooltip="Texto para reconocer la tabla (por ejemplo, la cobertura o el plan al que pertenece). No se muestra al asegurado."
              >
                <Input
                  id="tabla-edad-descripcion"
                  value={descripcion}
                  maxLength={LARGO_DESCRIPCION}
                  disabled={guardando}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
              </FormField>
            </FormGrid>

            {estadoCodigo === 'verificando' && (
              <p className="text-xs text-slate-500">Verificando si el código ya existe en Sis2000…</p>
            )}
            {estadoCodigo === 'libre' && (
              <p className="text-xs font-medium text-emerald-700">Código disponible: no hay otra tabla con ese nombre.</p>
            )}
            {estadoCodigo === 'sin-verificar' && (
              <p className="text-xs text-amber-700">
                No se pudo verificar el código ahora; si ya existe, Sis2000 lo rechazará al guardar.
              </p>
            )}
            {estadoCodigo === 'existe' && existente && (
              <Alert variant="warning">
                <p className="font-semibold">
                  La tabla {existente.ctablaedad} ya existe ({existente.xtablaedad || 'sin descripción'}) con{' '}
                  {(existente.tramos ?? []).length} tramo{(existente.tramos ?? []).length === 1 ? '' : 's'}.
                </p>
                <p className="mt-1">
                  No hace falta crearla otra vez. Usa la existente o cambia el código si necesitas precios distintos.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={usarExistente} disabled={!(existente.tramos ?? []).length}>
                    Usar la existente
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setCodigoCopiar(existente.ctablaedad);
                      setRapido('copiar');
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar sus tramos a una tabla nueva
                  </Button>
                </div>
              </Alert>
            )}

            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                <Wand2 className="h-3.5 w-3.5" />
                Carga rápida de tramos
                <InfoTip text="Evita escribir tramo por tramo. Cada opción reemplaza los tramos de abajo; después puedes ajustar cualquier valor a mano." />
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ['estandar', '0–17 / 18–64 / 65–74'],
                    ['ancho', 'Cada N años'],
                    ['unica', 'Una sola prima para todo'],
                    ['pegar', 'Pegar desde Excel'],
                    ['copiar', 'Copiar de otra tabla'],
                  ] as const
                ).map(([valor, etiqueta]) => (
                  <button
                    key={valor}
                    type="button"
                    disabled={guardando}
                    onClick={() => {
                      setAvisoRapido(null);
                      setRapido((r) => (r === valor ? null : valor));
                    }}
                    className={
                      rapido === valor
                        ? 'rounded-lg border border-indigo-500 bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white'
                        : 'rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-800 hover:bg-indigo-50'
                    }
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>

              {rapido === 'estandar' && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-600">Crea 3 tramos: niños (0–17), adultos (18–64) y mayores (65–74). Luego pones el precio de cada uno.</span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => aplicarRapido(generarTramos(TRAMOS_ESTANDAR), 'Tramos 0–17, 18–64 y 65–74 listos: escribe la prima o la tasa de cada uno.')}
                  >
                    Generar
                  </Button>
                </div>
              )}

              {rapido === 'ancho' && (
                <div className="mt-3 flex flex-wrap items-end gap-2 text-xs">
                  <label className="grid gap-1">
                    Desde
                    <Input className="h-8 w-16 px-2 text-xs" inputMode="numeric" value={anchoDesde} onChange={(e) => setAnchoDesde(e.target.value)} />
                  </label>
                  <label className="grid gap-1">
                    Hasta
                    <Input className="h-8 w-16 px-2 text-xs" inputMode="numeric" value={anchoHasta} onChange={(e) => setAnchoHasta(e.target.value)} />
                  </label>
                  <label className="grid gap-1">
                    Cada (años)
                    <Input className="h-8 w-16 px-2 text-xs" inputMode="numeric" value={ancho} onChange={(e) => setAncho(e.target.value)} />
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const rangos = tramosPorAncho(Number(anchoDesde), Number(anchoHasta), Number(ancho));
                      aplicarRapido(generarTramos(rangos), `${rangos.length} tramos de ${ancho} años listos: escribe el precio de cada uno.`);
                    }}
                  >
                    Generar
                  </Button>
                </div>
              )}

              {rapido === 'unica' && (
                <div className="mt-3 flex flex-wrap items-end gap-2 text-xs">
                  <label className="grid gap-1">
                    Monto
                    <Input
                      className="h-8 w-28 px-2 text-xs"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={precioUnico}
                      onChange={(e) => setPrecioUnico(e.target.value)}
                    />
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <input type="radio" className="accent-primary" checked={precioUnicoEs === 'prima'} onChange={() => setPrecioUnicoEs('prima')} />
                    Prima fija
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <input type="radio" className="accent-primary" checked={precioUnicoEs === 'tasa'} onChange={() => setPrecioUnicoEs('tasa')} />
                    Tasa %
                  </label>
                  <Button type="button" size="sm" onClick={aplicarPrecioUnico}>
                    Aplicar a todos los tramos
                  </Button>
                  <span className="w-full text-slate-500">
                    Si no hay tramos con edades, se crea uno de 0 a 74 años con ese precio.
                  </span>
                </div>
              )}

              {rapido === 'pegar' && (
                <div className="mt-3 space-y-2 text-xs">
                  <label className="grid gap-1">
                    Columnas copiadas de Excel, en este orden
                    <select
                      className="h-8 w-full max-w-xs rounded-md border border-border bg-background px-2"
                      value={columnasPegado}
                      onChange={(e) => setColumnasPegado(e.target.value as ColumnasPegado)}
                    >
                      {COLUMNAS_PEGADO.map((c) => (
                        <option key={c.valor} value={c.valor}>
                          {c.etiqueta}
                        </option>
                      ))}
                    </select>
                  </label>
                  <textarea
                    aria-label="Tramos pegados desde Excel"
                    className="h-28 w-full rounded-lg border border-border bg-white p-2 font-mono text-xs"
                    placeholder={'0\t17\t12,50\n18\t64\t25,00\n65\t74\t48,00'}
                    value={textoPegado}
                    onChange={(e) => setTextoPegado(e.target.value)}
                  />
                  <p className="text-slate-500">
                    Selecciona las celdas en Excel, copia (Ctrl+C) y pega aquí (Ctrl+V). Se aceptan coma o punto decimal; la
                    fila de títulos se ignora sola. La suma asegurada, si viene, no se guarda en la tabla (va en la cobertura).
                  </p>
                  <Button type="button" size="sm" onClick={aplicarPegado} disabled={!textoPegado.trim()}>
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    Cargar tramos
                  </Button>
                </div>
              )}

              {rapido === 'copiar' && (
                <div className="mt-3 flex flex-wrap items-end gap-2 text-xs">
                  <label className="grid gap-1">
                    Código de la tabla a copiar
                    <Input
                      className="h-8 w-32 px-2 text-xs"
                      value={codigoCopiar}
                      maxLength={LARGO_CODIGO}
                      onChange={(e) => setCodigoCopiar(e.target.value.toUpperCase())}
                    />
                  </label>
                  <Button type="button" size="sm" onClick={() => void copiarDeOtra()} disabled={copiando || !codigoCopiar.trim()}>
                    <Copy className="h-3.5 w-3.5" />
                    {copiando ? 'Copiando…' : 'Copiar tramos'}
                  </Button>
                </div>
              )}

              {avisoRapido && (
                <p className={avisoRapido.tipo === 'ok' ? 'mt-2 text-xs font-medium text-emerald-700' : 'mt-2 text-xs font-medium text-rose-700'}>
                  {avisoRapido.texto}
                </p>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        Edad desde
                        <InfoTip text="Edad mínima (años cumplidos) a la que aplica este precio." />
                      </span>
                    </th>
                    <th className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        Edad hasta
                        <InfoTip text="Edad máxima a la que aplica este precio, incluida. Los tramos no pueden pisarse entre sí." />
                      </span>
                    </th>
                    <th className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        Tasa (%)
                        <InfoTip text="Porcentaje de la suma asegurada que se cobra como prima anual. Ejemplo: 0,449 significa 0,449 % (4,49 por mil). Déjala vacía si el precio es un monto fijo." />
                      </span>
                    </th>
                    <th className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        Prima fija
                        <InfoTip text="Monto fijo anual por persona en este tramo, en la moneda del plan. Déjala vacía si el precio se calcula con la tasa." />
                      </span>
                    </th>
                    <th className="w-8 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-2 py-1.5">
                        <Input
                          aria-label={`Edad desde · tramo ${i + 1}`}
                          inputMode="numeric"
                          value={f.desde}
                          disabled={guardando}
                          onChange={(e) => cambiarFila(i, { desde: e.target.value })}
                          className="h-8 w-20 rounded-lg px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          aria-label={`Edad hasta · tramo ${i + 1}`}
                          inputMode="numeric"
                          value={f.hasta}
                          disabled={guardando}
                          onChange={(e) => cambiarFila(i, { hasta: e.target.value })}
                          className="h-8 w-20 rounded-lg px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          aria-label={`Tasa en porcentaje · tramo ${i + 1}`}
                          inputMode="decimal"
                          placeholder="0"
                          value={f.tasa}
                          disabled={guardando}
                          onChange={(e) => cambiarFila(i, { tasa: e.target.value })}
                          className="h-8 w-28 rounded-lg px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          aria-label={`Prima fija · tramo ${i + 1}`}
                          inputMode="decimal"
                          placeholder="0"
                          value={f.prima}
                          disabled={guardando}
                          onChange={(e) => cambiarFila(i, { prima: e.target.value })}
                          className="h-8 w-28 rounded-lg px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          aria-label={`Quitar tramo ${i + 1}`}
                          disabled={guardando || filas.length === 1}
                          onClick={() => setFilas((prev) => prev.filter((_, j) => j !== i))}
                          className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button type="button" variant="outline" size="sm" disabled={guardando} onClick={agregarTramo}>
              <Plus className="h-3.5 w-3.5" />
              Agregar tramo
            </Button>

            {intento && errores.length > 0 && (
              <Alert variant="error">
                <ul className="list-disc space-y-0.5 pl-4">
                  {errores.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </Alert>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={guardando} onClick={onClose}>
            {modo === 'crear' ? 'Cancelar' : 'Cerrar'}
          </Button>
          {modo === 'crear' && (
            <Button type="button" disabled={guardando || estadoCodigo === 'existe'} onClick={() => void guardar()}>
              {guardando ? 'Guardando…' : 'Guardar tabla'}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
