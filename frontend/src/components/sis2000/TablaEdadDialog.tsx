import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
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

interface FilaTramo {
  desde: string;
  hasta: string;
  tasa: string;
  prima: string;
}

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
    if (decimales(f.prima) > 2) errores.push(`${n}: la prima admite hasta 2 decimales.`);
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
}

/**
 * Tabla de precios por edad de un plan de personas (mapltabedad + mapltabedad_d). «Crear» guarda cabecera y tramos en
 * una sola llamada; «Ver» solo consulta.
 */
export function TablaEdadDialog({ modo, codigo: codigoInicial, descripcion: descripcionInicial = '', onClose, onCreada }: Props) {
  const [codigo, setCodigo] = useState(codigoInicial.trim().toUpperCase().slice(0, LARGO_CODIGO));
  const [descripcion, setDescripcion] = useState(descripcionInicial.trim().slice(0, LARGO_DESCRIPCION));
  const [filas, setFilas] = useState<FilaTramo[]>([TRAMO_INICIAL]);
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
      setError(e instanceof Error ? e.message : 'No se pudo crear la tabla.');
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
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
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
                        <td className="px-3 py-1.5">{formato(t.mprima, 2)}</td>
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
            <Button type="button" disabled={guardando} onClick={() => void guardar()}>
              {guardando ? 'Guardando…' : 'Guardar tabla'}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
