import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Boxes,
  Calculator,
  ClipboardCheck,
  Equal,
  Eye,
  FileText,
  Lock,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { agruparProductosSis2000, type Sis2000Product } from '@/lib/sis2000-catalog';
import {
  defaultPlanPayload,
  esSumaCalculada,
  formatTarifaDescripcion,
  indexarSumaConfig,
  normalizePlanPayloadForApi,
  sis2000PlanMasterId,
  textoSumaCalculada,
  validarSumaConfig,
  validatePlanPayload,
  type CoberturaSumaConfig,
  type CoberturaSumaConfigPorCodigo,
  type Sis2000NestRow,
  type Sis2000PlanType,
} from '@/lib/sis2000-nest-api';
import { claveHistorial } from '@/lib/sis2000-historial';
import { AppShell } from '@/components/layout/AppShell';
import {
  CoberturaSumaConfigFields,
  type SumaConfigValores,
} from '@/components/sis2000/CoberturaSumaConfigFields';
import { Sis2000NuevaCoberturaForm } from '@/components/sis2000/Sis2000NuevaCoberturaForm';
import { CoberturaFichaPanel } from '@/components/configurador/CoberturaFichaPanel';
import {
  PRODUCTORES_DEFAULT,
  ProductoresSelector,
  productoresToPayloadFields,
  validarProductores,
  type ProductoresSelection,
} from '@/components/sis2000/ProductoresSelector';
import {
  CANALES_DEFAULT,
  CanalesSelector,
  canalesFromPayload,
  canalesToPayloadFields,
  type CanalesSelection,
} from '@/components/sis2000/CanalesSelector';
import { ProveedoresPlanPanel } from '@/components/sis2000/ProveedoresPlanPanel';
import { CobroDiasPanel } from '@/components/sis2000/CobroDiasPanel';
import { HistorialPanel } from '@/components/sis2000/HistorialPanel';
import { TablaEdadDialog, type TablaEdad } from '@/components/sis2000/TablaEdadDialog';
import { TablaEdadBuscador } from '@/components/sis2000/TablaEdadBuscador';
import {
  nombreParentesco,
  ParentescosSelector,
  type Parentesco,
} from '@/components/sis2000/ParentescosSelector';
import {
  BarraPasos,
  ComoSeUsa,
  ConfirmarDialog,
  DetallesTecnicos,
  NavegacionPasos,
  type EstadoPaso,
  type PasoAsistente,
} from '@/components/sis2000/AsistentePasos';
import { formatoMonto2 } from '@/lib/sis2000-tramos';
import { normalizarRamo, type FamiliaRamo } from '@/lib/configurador';
import {
  ETIQUETA_ESTADO,
  PASO_COMBO_DE_SECCION,
  estadoGrupo,
  grupoDeSeccion,
  gruposCompletar,
  type EstadoGrupo,
} from '@/lib/configurador-combo';
import { CompletarPlan, usePlanCompletar } from '@/components/configurador/CompletarPlan';
import { PasoAnimado } from '@/components/ayudas/PasoAnimado';
import { ListaAnimada } from '@/components/ayudas/ListaAnimada';
import { useAvisoComplementario } from '@/lib/ayudas/avisos';
import { PanelAyudas } from '@/components/ayudas/PanelAyudas';
import { useAyudas } from '@/components/ayudas/AyudasProvider';
import { comandosDeRamos } from '@/lib/ayudas/busqueda';
import { useRegistrarComandos } from '@/lib/ayudas/usar-comandos';
import { entenderError, miles, mensajeDeError, type ErrorEntendible } from '@/lib/errores';
import { AlertaError, irACampo } from '@/components/ui/errores';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComboBuscable, type OpcionCombo } from '@/components/ui/combo-buscable';
import { FormField, FormGrid } from '@/components/ui/form-field';
import { InfoTip } from '@/components/ui/info-tip';
import { Input } from '@/components/ui/input';
import { SectionPanel } from '@/components/ui/section-panel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** Peticiones de tarifas en vuelo a la vez (una por cobertura del ramo). */
const TARIFAS_EN_PARALELO = 5;
/** Valor del selector de ramo cuando no se filtra (Radix Select no admite valor vacío). */
const RAMO_TODOS = 'todos';

/** Formulario «Crear producto en este ramo» (sp_CrearProducto). */
const PRODUCTO_NUEVO = {
  cproducto: '',
  xdescripcion_l: '',
  xdescripcion_c: '',
  xabreviatura: '',
  iproductor: true,
  icanal: true,
};

interface Frecuencia {
  ifrecuencia: string;
  xfrecuencia: string;
  ndias?: number;
}

/** Frecuencias de pago que admite el plan (maplanes_frec). */
const FRECUENCIAS: Frecuencia[] = [
  { ifrecuencia: 'A', xfrecuencia: 'Anual', ndias: 365 },
  { ifrecuencia: 'S', xfrecuencia: 'Semestral', ndias: 180 },
  { ifrecuencia: 'T', xfrecuencia: 'Trimestral', ndias: 90 },
  { ifrecuencia: 'M', xfrecuencia: 'Mensual', ndias: 30 },
];

const SEXOS = [
  { valor: 'A', etiqueta: 'Ambos' },
  { valor: 'M', etiqueta: 'Masculino' },
  { valor: 'F', etiqueta: 'Femenino' },
];

/** Datos de la cabecera del plan que el formulario no muestra pero que se conservan al editar. */
const CABECERA_CONSERVADA = ['itiporen', 'idevolucion', 'ctipo', 'ctenedor', 'cbeneficiario', 'bnacional'] as const;

/** Cómo se cobra una cobertura de cosas: tasa % sobre la suma o prima fija (excluyentes). */
type ModoPrecio = 'tasa' | 'prima';

/** Lo propio de personas por cobertura: tabla de tasas (vacía = la del plan) y si es obligatoria en el plan. */
interface FilaPersonas {
  ctablatar: string;
  obligatoria: boolean;
}

const FILA_PERSONAS: FilaPersonas = { ctablatar: '', obligatoria: true };

/** Borrador del combo en este navegador (no se pierde lo llenado al recargar o si falla la creación). */
const CLAVE_BORRADOR = 'pb.combo-coberturas.borrador.v1';

interface BorradorCombo {
  ramoFiltro: string;
  claveProducto: string;
  tipoPlan: Sis2000PlanType;
  /** Eligió «Automóvil» (el plan se graba como cosas). */
  automovil?: boolean;
  parentescosTxt: string;
  csexo: string;
  edadMin: string;
  edadMax: string;
  tablaPlan: string;
  cplan: string;
  xplan: string;
  fdesde: string;
  fhasta: string;
  cmoneda: string;
  frecuencias: string[];
  productoresSel: ProductoresSelection;
  canalesSel: CanalesSelection;
  observacion?: string;
  /** Ramo al que pertenecen las filas guardadas (si el usuario cambia de ramo, no se aplican). */
  cramo: number;
  filas: Record<string, FilaCombo>;
  filasPer: Record<string, FilaPersonas>;
  guardado: string;
}

function leerBorrador(): BorradorCombo | null {
  try {
    const raw = window.localStorage.getItem(CLAVE_BORRADOR);
    if (!raw) return null;
    const b = JSON.parse(raw) as Partial<BorradorCombo>;
    return b && typeof b === 'object' && typeof b.claveProducto === 'string' ? (b as BorradorCombo) : null;
  } catch {
    return null;
  }
}

function guardarBorrador(b: BorradorCombo) {
  try {
    window.localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(b));
  } catch {
    // Sin almacenamiento (modo privado o lleno): la pantalla sigue funcionando sin borrador.
  }
}

function borrarBorrador() {
  try {
    window.localStorage.removeItem(CLAVE_BORRADOR);
  } catch {
    // ignorar
  }
}

/** Pasos del asistente. */
const PASOS = [
  { id: 'producto', titulo: 'Producto', resumen: 'Ramo, producto y tipo de plan' },
  { id: 'coberturas', titulo: 'Coberturas', resumen: 'Qué cubre el plan' },
  { id: 'precios', titulo: 'Tarifas y tasas', resumen: 'Suma asegurada y cómo se cobra cada cobertura' },
  { id: 'datos', titulo: 'Datos del plan', resumen: 'Nombre, vigencia, moneda, pagos y quién lo ofrece' },
  { id: 'revisar', titulo: 'Revisar y confirmar', resumen: 'Qué se va a guardar en Sis2000' },
] as const;

type PasoId = (typeof PASOS)[number]['id'];

/** Algo que falta o está mal, con el paso donde se corrige. */
interface Falta {
  paso: PasoId;
  texto: string;
  /** id del campo donde se corrige (el resumen lleva ahí). */
  campo?: string;
  /** Cobertura a la que se refiere (se muestra también en su tarjeta). */
  cob?: string;
}

/** Propiedad de PlanDto que nest-api rechazó → id del campo en el asistente. */
function idCampoPlan(propiedad: string): string | undefined {
  const ids: Record<string, string> = {
    cplan: 'combo-cplan',
    xplan: 'combo-xplan',
    fdesde: 'combo-fdesde',
    fhasta: 'combo-fhasta',
    cmoneda: 'combo-cmoneda',
    xobservacion: 'combo-xobservacion',
    frecuencias: 'combo-frecuencias',
    productores: 'combo-prod-buscar',
    cproducto: 'combo-producto',
    cramo: 'combo-ramo',
    nedad_min: 'combo-edad-min',
    nedad_max: 'combo-edad-max',
    cparen: 'combo-cparen-texto',
    parentescos: 'combo-cparen-texto',
  };
  return ids[propiedad];
}

/** Tasa en % con hasta 6 decimales, en formato local. */
const fmtTasa = (n: number) => n.toLocaleString('es-VE', { maximumFractionDigits: 6 });

/** 'YYYY-MM-DD' → 'dd/mm/aaaa' (vacío si no es fecha). */
function fechaCorta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Precio de un tramo en palabras («prima 12,50» o «tasa 0,449 % × suma»). */
function precioTramo(t: { pprima?: number; mprima?: number }, suma: number, moneda: string): string {
  const prima = Number(t.mprima ?? 0);
  const tasa = Number(t.pprima ?? 0);
  if (prima > 0) return `prima fija ${moneda} ${formatoMonto2(prima)}`;
  if (tasa > 0) {
    return suma > 0
      ? `tasa ${fmtTasa(tasa)} % × suma ${formatoMonto2(suma)} = ${moneda} ${formatoMonto2((suma * tasa) / 100)}`
      : `tasa ${fmtTasa(tasa)} % sobre la suma asegurada`;
  }
  return 'sin precio';
}

/** Entero ≥ 0 de un input ('' o inválido = null). */
function entero(valor: string): number | null {
  const t = valor.trim();
  return /^\d+$/.test(t) ? Number(t) : null;
}

/** Estilo de las casillas y radios sueltos (igual que en el asistente de coberturas). */
const ETIQUETA_OPCION =
  'inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-xs font-medium';

interface CoberturaRamo {
  ccobertura: string;
  descripcion: string;
  cmoneda: string;
  inactiva: boolean;
  /** Fila completa de macoberturas (para el buscador). */
  fila: Sis2000NestRow;
}

type CargaTarifas =
  | { estado: 'cargando' }
  | { estado: 'ok'; tarifas: Sis2000NestRow[] }
  | { estado: 'error'; error: string };

/** Lo que se arma por cobertura; los montos quedan como texto del input. */
interface FilaCombo {
  incluir: boolean;
  ctarifa: string;
  msumamin: string;
  msumamax: string;
  pprima: string;
  mprima: string;
  /** Cosas: tasa o prima fija (solo se graba la elegida; la otra va en 0). */
  modo: ModoPrecio;
}

interface VistaCobertura {
  cobertura: CoberturaRamo;
  carga: CargaTarifas | undefined;
  /** Tarifas con iestado V: las únicas que nest-api acepta en un plan. */
  vigentes: Sis2000NestRow[];
  tarifa: Sis2000NestRow | undefined;
  fila: FilaCombo | undefined;
  obligatoria: boolean;
  /** Suma asegurada FIJA o CALCULADA al emitir (Postgres del configurador). */
  sumaConfig: CoberturaSumaConfig | undefined;
  calculada: boolean;
}

type VistaIncluida = VistaCobertura & { fila: FilaCombo; tarifa: Sis2000NestRow };

interface PlanGuardado {
  cramo: number;
  cplan: string;
  tipo: Sis2000PlanType;
  /** Se eligió «Automóvil» (grabado como cosas): la ficha sigue con tipo y uso y tasas por antigüedad. */
  automovil: boolean;
  /** Frecuencia con la que se cotiza: Anual si el plan la tiene, si no la primera del plan. */
  ifrecuencia: string;
  editado: boolean;
  /** Personas: parentesco y edad con los que se prueba spCalculoPer (primer parentesco, edad mínima del rango). */
  cotizarPersona?: { cparen: number; nedad: number };
}

/** Plan leído de Sis2000 para editarlo con el formulario. */
interface PlanOriginal {
  /** Plan en la forma de PlanDto (lo que devuelve v1/configurador/planes/:cramo/:cplan). */
  plan: Record<string, unknown>;
  tipo: Sis2000PlanType;
  /** Coberturas que ya tiene el plan (no se quitan desde aquí). */
  coberturas: string[];
  advertencias: string[];
  /** Personas: por qué el formulario no puede guardarlo sin perder datos (null = se puede). */
  bloqueo: string | null;
}

const texto = (v: unknown) => (v == null ? '' : String(v).trim());

/** Fecha local YYYY-MM-DD (toISOString es UTC: en Venezuela pasa al día siguiente desde las 8 p. m.). */
function hoyIso(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Monto del input → número (vacío o inválido = 0). */
function numero(valor: string): number {
  const n = Number(valor);
  return valor.trim() !== '' && Number.isFinite(n) ? n : 0;
}

/** Número de Sis2000 → texto del input ('' si no viene). */
function aInput(valor: unknown): string {
  if (valor == null || valor === '') return '';
  const n = Number(valor);
  return Number.isFinite(n) ? String(n) : '';
}

/** Con tasa se cobra por tasa; si solo hay prima fija, por prima. */
function modoInicial(pprima: string, mprima: string): ModoPrecio {
  return numero(pprima) > 0 || !(numero(mprima) > 0) ? 'tasa' : 'prima';
}

const formatoMonto = (n: number) =>
  n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const esVigente = (tarifa: Sis2000NestRow) => texto(tarifa.iestado).toUpperCase() === 'V';

/** En cosas la obligatoriedad no se guarda por plan: sale de matarifa.bobligatoria; la 1 es la básica. */
function esObligatoria(tarifa: Sis2000NestRow | undefined, ccobertura: string): boolean {
  if (ccobertura === '1') return true;
  const valor = tarifa?.bobligatoria;
  if (typeof valor === 'boolean') return valor;
  return ['T', 'S', '1', 'TRUE', 'Y'].includes(texto(valor).toUpperCase());
}

/**
 * Detalle de tarifa (matarifa_d) vigente hoy: iestado V o A, fdesde ≤ hoy y fhasta vacía o ≥ hoy; el de
 * fdesde más reciente. Si ninguno está vigente, el más reciente.
 */
function detalleVigente(tarifa: Sis2000NestRow | undefined, hoy: string): Sis2000NestRow | null {
  const raw = tarifa?.detalles;
  const detalles = Array.isArray(raw) ? (raw as Sis2000NestRow[]) : [];
  if (!detalles.length) return null;
  const fecha = (v: unknown) => texto(v).slice(0, 10);
  const recientes = [...detalles].sort((a, b) => fecha(b.fdesde).localeCompare(fecha(a.fdesde)));
  const vigente = recientes.find((d) => {
    const estado = texto(d.iestado).toUpperCase();
    const hasta = fecha(d.fhasta);
    return (estado === 'V' || estado === 'A') && fecha(d.fdesde) <= hoy && (!hasta || hasta >= hoy);
  });
  return vigente ?? recientes[0];
}

function valoresDeTarifa(
  tarifa: Sis2000NestRow | undefined,
  hoy: string,
): Omit<FilaCombo, 'incluir'> {
  const detalle = detalleVigente(tarifa, hoy);
  const pprima = aInput(detalle?.pprima);
  const mprima = aInput(detalle?.mprima);
  return {
    ctarifa: texto(tarifa?.ctarifa),
    msumamin: aInput(detalle?.msumamin),
    msumamax: aInput(detalle?.msumamax),
    pprima,
    mprima,
    modo: modoInicial(pprima, mprima),
  };
}

/** Fila nueva: primera tarifa vigente; las obligatorias entran incluidas. */
function filaInicial(ccobertura: string, tarifas: Sis2000NestRow[], hoy: string): FilaCombo {
  const tarifa = tarifas.find(esVigente);
  return {
    incluir: Boolean(tarifa) && esObligatoria(tarifa, ccobertura),
    ...valoresDeTarifa(tarifa, hoy),
  };
}

/** Fila guardada (borrador viejo sin «modo» o plan leído): se completa el modo. */
function normalizarFila(f: FilaCombo): FilaCombo {
  return { ...f, modo: f.modo === 'prima' || f.modo === 'tasa' ? f.modo : modoInicial(f.pprima, f.mprima) };
}

/** Opción de tarifa en palabras (sin código ni nombre interno): «Opción 1 · tasa 0,5 % · suma hasta $ 50.000». */
function etiquetaTarifa(t: Sis2000NestRow, i: number, hoy: string, moneda: string): string {
  const d = detalleVigente(t, hoy);
  const partes = [`Opción ${i + 1}`];
  if (d) {
    const tasa = Number(d.pprima ?? 0);
    const prima = Number(d.mprima ?? 0);
    const max = Number(d.msumamax ?? 0);
    if (tasa > 0) partes.push(`tasa ${fmtTasa(tasa)} %`);
    else if (prima > 0) partes.push(`prima fija ${moneda} ${formatoMonto2(prima)}`);
    if (max > 0) partes.push(`suma hasta ${moneda} ${formatoMonto2(max)}`);
    const desde = fechaCorta(texto(d.fdesde));
    if (desde) partes.push(`desde ${desde}`);
  }
  return partes.join(' · ');
}

function aCoberturaRamo(fila: Sis2000NestRow): CoberturaRamo {
  return {
    ccobertura: texto(fila.ccobertura),
    descripcion: texto(fila.xdescripcion_l ?? fila.xcobertura ?? fila.xdescripcion_c),
    cmoneda: texto(fila.cmoneda),
    inactiva: texto(fila.iestado).toUpperCase() === 'I',
    fila,
  };
}

/** Moneda más usada por las coberturas activas del ramo ('$' si no traen). */
function monedaDelRamo(coberturas: CoberturaRamo[]): string {
  const cuenta = new Map<string, number>();
  for (const c of coberturas) {
    if (!c.inactiva && c.cmoneda) cuenta.set(c.cmoneda, (cuenta.get(c.cmoneda) ?? 0) + 1);
  }
  let moneda = '$';
  let max = 0;
  cuenta.forEach((n, m) => {
    if (n > max) {
      moneda = m;
      max = n;
    }
  });
  return moneda;
}

function opcionesMoneda(filas: Sis2000NestRow[]): Array<{ codigo: string; nombre: string }> {
  const vistas = new Set<string>();
  const out: Array<{ codigo: string; nombre: string }> = [];
  for (const m of filas) {
    const codigo = texto(m.cmoneda ?? m.codigo ?? m.cvalor);
    if (!codigo || vistas.has(codigo)) continue;
    vistas.add(codigo);
    out.push({ codigo, nombre: texto(m.xmoneda ?? m.xdescripcion_l ?? m.xdescripcion ?? m.descripcion) });
  }
  return out;
}

/** Ejecuta `tarea` por elemento con como mucho `limite` en vuelo (la tarea no debe lanzar). */
async function enParalelo<T>(items: T[], limite: number, tarea: (item: T) => Promise<void>) {
  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < items.length) {
      const item = items[siguiente];
      siguiente += 1;
      await tarea(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, trabajador));
}

/** Producto provisional (aún no aparece en el catálogo): el plan solo necesita cproducto y cramo. */
function productoProvisional(cproducto: string, cramo: number, nombre = '', extra: Partial<Sis2000Product> = {}): Sis2000Product {
  return {
    cproducto,
    cramo,
    u_version: null,
    xdescripcion_l: nombre,
    xdescripcion_c: null,
    xabreviatura: '',
    iproductor: true,
    icanal: true,
    xform: '',
    cprog: null,
    ifuente: null,
    bok: null,
    cerror: null,
    fingreso: null,
    cusuario: null,
    ...extra,
  } as unknown as Sis2000Product;
}

/** Lo que el formulario necesita de un plan leído de Sis2000. */
interface PlanParaFormulario {
  tipo: Sis2000PlanType;
  cramo: number;
  cproducto: string;
  filas: Record<string, FilaCombo>;
  filasPer: Record<string, FilaPersonas>;
  personas: { cparens: number[]; csexo: string; min: number; max: number } | null;
  frecuencias: Frecuencia[];
  productores: ProductoresSelection;
  canales: CanalesSelection;
  bloqueo: string | null;
}

/**
 * Pasa el plan de Sis2000 (forma de PlanDto) a los campos del formulario. En personas el formulario usa los
 * mismos parentescos, sexo y edades para todas las coberturas y la misma tabla y montos para todos los
 * parentescos de una cobertura: si el plan no es así, `bloqueo` lo explica (guardar perdería esa diferencia).
 */
function planAFormulario(plan: Record<string, unknown>, tipoLeido: string): PlanParaFormulario {
  const tipo: Sis2000PlanType = texto(tipoLeido || plan.type) === 'personas' ? 'personas' : 'cosas';
  const coberturas = Array.isArray(plan.coberturas) ? (plan.coberturas as Record<string, unknown>[]) : [];
  const filas: Record<string, FilaCombo> = {};
  const filasPer: Record<string, FilaPersonas> = {};
  let personas: PlanParaFormulario['personas'] = null;
  let bloqueo: string | null = null;
  const marcar = (motivo: string) => {
    if (!bloqueo) bloqueo = motivo;
  };

  for (const c of coberturas) {
    const cc = texto(c.ccobertura);
    if (!cc) continue;
    if (tipo === 'personas') {
      const ps = Array.isArray(c.parentescos) ? (c.parentescos as Record<string, unknown>[]) : [];
      if (!ps.length) {
        marcar(`una cobertura del plan no tiene parentescos (${cc})`);
        continue;
      }
      const p0 = ps[0];
      const firma = (p: Record<string, unknown>) =>
        [texto(p.csexo) || 'A', Number(p.nedad_min), Number(p.nedad_max)].join('|');
      const precio = (p: Record<string, unknown>) =>
        [texto(p.ctablatar).toUpperCase(), Number(p.msuma ?? 0), Number(p.msumamax ?? 0), Number(p.mprima ?? 0)].join('|');
      if (ps.some((p) => firma(p) !== firma(p0))) marcar('las edades o el sexo cambian según el parentesco');
      if (ps.some((p) => precio(p) !== precio(p0))) marcar('la tabla de tasas o los montos cambian según el parentesco');
      if (Number(p0.msuma ?? 0) !== Number(p0.msumamax ?? 0)) marcar('la suma y la suma máxima por persona son distintas');
      const cparens = ps.map((p) => Number(p.cparen)).filter((n) => Number.isInteger(n) && n > 0);
      const base = {
        cparens: [...cparens].sort((a, b) => a - b),
        csexo: texto(p0.csexo) || 'A',
        min: Number(p0.nedad_min) || 0,
        max: Number(p0.nedad_max) || 0,
      };
      if (!personas) personas = base;
      else if (
        personas.cparens.join(',') !== base.cparens.join(',') ||
        personas.csexo !== base.csexo ||
        personas.min !== base.min ||
        personas.max !== base.max
      ) {
        marcar('las coberturas no tienen los mismos parentescos, sexo o edades');
      }
      filas[cc] = {
        incluir: true,
        ctarifa: texto(c.ctarifa),
        msumamin: '',
        msumamax: aInput(p0.msumamax ?? p0.msuma),
        pprima: '',
        mprima: aInput(p0.mprima),
        modo: 'prima',
      };
      filasPer[cc] = { ctablatar: texto(p0.ctablatar).toUpperCase(), obligatoria: c.bobligatoria !== false };
    } else {
      const pprima = aInput(c.pprima);
      const mprima = aInput(c.mprima);
      filas[cc] = {
        incluir: true,
        ctarifa: texto(c.ctarifa),
        msumamin: aInput(c.msumamin),
        msumamax: aInput(c.msumamax),
        pprima,
        mprima,
        modo: modoInicial(pprima, mprima),
      };
    }
  }

  const frecuencias = (Array.isArray(plan.frecuencias) ? (plan.frecuencias as Record<string, unknown>[]) : [])
    .map((f) => ({
      ifrecuencia: texto(f.ifrecuencia),
      xfrecuencia: texto(f.xfrecuencia) || texto(f.ifrecuencia),
      ndias: Number(f.ndias) > 0 ? Number(f.ndias) : undefined,
    }))
    .filter((f) => f.ifrecuencia);

  const listaProductores = Array.isArray(plan.productores) ? (plan.productores as unknown[]) : [];
  const productores: ProductoresSelection =
    plan.all_productor === true
      ? { todos: true, productores: [] }
      : {
          todos: false,
          productores: listaProductores
            .map((p) => Number(typeof p === 'object' && p !== null ? (p as Record<string, unknown>).cproductor : p))
            .filter((n) => Number.isInteger(n) && n > 0)
            .map((cproductor) => ({ cproductor })),
        };

  return {
    tipo,
    cramo: Number(plan.cramo) || 0,
    cproducto: texto(plan.cproducto),
    filas,
    filasPer,
    personas,
    frecuencias,
    productores,
    canales: canalesFromPayload(plan),
    bloqueo: bloqueo
      ? `Este plan no se puede guardar desde el formulario porque ${bloqueo}: el formulario usa los mismos datos para todos y se perdería esa diferencia. Usa el modo avanzado (JSON).`
      : null,
  };
}

/**
 * Ruta /sis2000/plans/:id/edit: el mismo asistente en modo edición, una instancia por plan (al pasar de un plan a
 * otro, o de editar a crear, el formulario empieza limpio).
 */
export function Sis2000PlanEditarPage() {
  const { id } = useParams<{ id?: string }>();
  return <Sis2000ComboPage key={`editar-${id ?? ''}`} />;
}

export function Sis2000ComboPage() {
  /** Con :id (cramo-cplan) la pantalla edita un plan existente; sin él arma un combo nuevo. */
  const { id: editId } = useParams<{ id?: string }>();
  const modoEdicion = Boolean(editId);
  /** «Crear plan» desde el catálogo de ramos: /sis2000/combos?cramo=28 deja elegido ese ramo. */
  const [busqueda] = useSearchParams();
  const ramoPedido = editId ? '' : (busqueda.get('cramo') ?? '').trim();
  const hoy = useMemo(hoyIso, []);
  /** Borrador guardado en este navegador (se lee una sola vez al abrir la pantalla; no aplica al editar). */
  const [inicio] = useState(() => (editId ? null : leerBorrador()));
  /**
   * Filas que aún no se aplicaron: se usan al llegar las tarifas del mismo ramo. `conservar` = vienen del plan
   * leído de Sis2000 (se respetan aunque su tarifa ya no esté vigente, para avisar en vez de perderlas).
   */
  const borradorFilas = useRef<{
    cramo: number;
    filas: Record<string, FilaCombo>;
    filasPer: Record<string, FilaPersonas>;
    conservar?: boolean;
  } | null>(
    inicio && inicio.cramo > 0 ? { cramo: inicio.cramo, filas: inicio.filas ?? {}, filasPer: inicio.filasPer ?? {} } : null,
  );
  const [borradorRestaurado] = useState(Boolean(inicio));
  /** true al pedir «Empezar de cero»: ya no se vuelve a guardar el borrador. */
  const sinBorrador = useRef(Boolean(editId));
  const [ultimoGuardado, setUltimoGuardado] = useState<string | null>(inicio?.guardado ?? null);

  // ── Asistente ──
  const [paso, setPaso] = useState(0);
  /** Paso en el que se pulsó «Siguiente» con cosas pendientes (muestra la lista). */
  const [avisoPaso, setAvisoPaso] = useState<number | null>(null);
  const arriba = useRef<HTMLDivElement>(null);

  const [productos, setProductos] = useState<Sis2000Product[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState(true);
  const [errorProductos, setErrorProductos] = useState<ErrorEntendible | null>(null);
  /** Producto elegido: clave cproducto|cramo (maproductos repite cada producto en SysIP y Nexus). */
  const [claveProducto, setClaveProducto] = useState(inicio?.claveProducto ?? '');
  /** Ramo elegido para filtrar el selector de producto (RAMO_TODOS = sin filtro). */
  const [ramoFiltro, setRamoFiltro] = useState(/^\d+$/.test(ramoPedido) ? ramoPedido : inicio?.ramoFiltro || RAMO_TODOS);
  /** Ramos de Sis2000 (maramos). Vacío si no se pudieron leer: el selector usa los ramos deducidos de los productos. */
  const [ramosSis2000, setRamosSis2000] = useState<Array<{ cramo: number; xdescripcion: string }>>([]);
  const [mostrarNuevoProducto, setMostrarNuevoProducto] = useState(false);
  const [nuevoProducto, setNuevoProducto] = useState(PRODUCTO_NUEVO);
  const [intentoProducto, setIntentoProducto] = useState(false);
  const [guardandoProducto, setGuardandoProducto] = useState(false);
  const [confirmandoProducto, setConfirmandoProducto] = useState(false);
  const [errorNuevoProducto, setErrorNuevoProducto] = useState<ErrorEntendible | null>(null);
  const [avisoProducto, setAvisoProducto] = useState<string | null>(null);

  const [catalogo, setCatalogo] = useState<{ cramo: number; coberturas: CoberturaRamo[] } | null>(
    null,
  );
  const [cargandoCoberturas, setCargandoCoberturas] = useState(false);
  const [errorCoberturas, setErrorCoberturas] = useState<ErrorEntendible | null>(null);
  const [tarifas, setTarifas] = useState<Record<string, CargaTarifas>>({});
  const [filas, setFilas] = useState<Record<string, FilaCombo>>({});
  const [mostrarInactivas, setMostrarInactivas] = useState(false);
  const [soloMarcadas, setSoloMarcadas] = useState(false);
  const [search, setSearch] = useState('');
  const [recarga, setRecarga] = useState(0);
  /** Sube con cada carga del ramo: las respuestas de una carga anterior se descartan. */
  const generacion = useRef(0);
  /** Coberturas cuyas tarifas ya se pidieron en la carga actual. */
  const solicitadas = useRef(new Set<string>());
  /** Coberturas creadas aquí que deben entrar marcadas cuando lleguen sus tarifas. */
  const porIncluir = useRef(new Set<string>());
  const [mostrarNuevaCobertura, setMostrarNuevaCobertura] = useState(false);
  const [avisoCobertura, setAvisoCobertura] = useState<string | null>(null);
  /** Suma asegurada por cobertura del ramo (FIJA / CALCULADA al emitir), por ccobertura. */
  const [sumaConfig, setSumaConfig] = useState<CoberturaSumaConfigPorCodigo>({});
  /** Cobertura cuya suma (FIJA / CALCULADA) se está editando. */
  const [editandoSuma, setEditandoSuma] = useState<string | null>(null);
  const [formSuma, setFormSuma] = useState<SumaConfigValores>({ tipoSuma: 'FIJA', unidadCalculo: '', etiquetaCuadro: '' });
  const [intentoSuma, setIntentoSuma] = useState(false);
  const [guardandoSuma, setGuardandoSuma] = useState(false);
  const [errorSuma, setErrorSuma] = useState<ErrorEntendible | null>(null);

  /** Cosas (maplanes + maplantar) o personas (maplanes_per + maplcober_per, mapltarifas_per, mapledades_per). */
  const [tipoPlan, setTipoPlan] = useState<Sis2000PlanType>(inicio?.tipoPlan === 'personas' ? 'personas' : 'cosas');
  const personas = tipoPlan === 'personas';
  /**
   * Solo UI: eligió «Automóvil». spMantPlanes no tiene tipo auto, así que el plan se graba como cosas (tipoPlan 'cosas')
   * y lo propio de vehículos (tipo y uso, tasas por antigüedad) sigue en la ficha del plan según GET ramos/:cramo.
   */
  const [automovil, setAutomovil] = useState(inicio?.automovil === true && inicio?.tipoPlan !== 'personas');
  /** Familia del ramo del producto (GET core/sis2000/ramos/:cramo); null mientras no se conoce. */
  const [familiaRamo, setFamiliaRamo] = useState<FamiliaRamo | null>(null);
  /** Ramo de solo lectura según nest-api (fianzas u otro): el panel «Ver / editar» no ofrece editar. */
  const [ramoSoloLectura, setRamoSoloLectura] = useState(false);
  /** Cobertura abierta en el panel lateral «Ver / editar» (código; null = cerrado). */
  const [fichaCob, setFichaCob] = useState<string | null>(null);
  /** Personas: tabla de tasas y obligatoriedad por cobertura. */
  const [filasPer, setFilasPer] = useState<Record<string, FilaPersonas>>({});
  /** Personas: parentescos (cparen, varios separados por coma), sexo, edades y tabla de tasas por defecto. */
  const [parentescosTxt, setParentescosTxt] = useState(inicio?.parentescosTxt ?? '1');
  const [csexo, setCsexo] = useState(inicio?.csexo ?? 'A');
  const [edadMin, setEdadMin] = useState(inicio?.edadMin ?? '0');
  const [edadMax, setEdadMax] = useState(inicio?.edadMax ?? '74');
  const [tablaPlan, setTablaPlan] = useState(inicio?.tablaPlan ?? '');
  /** Personas: diálogo para crear o ver una tabla de tasas por edad; destino = 'plan' o el código de la cobertura. */
  const [tablaDlg, setTablaDlg] = useState<{
    modo: 'crear' | 'ver';
    destino: string;
    codigo: string;
    descripcion: string;
  } | null>(null);
  /** Personas: buscador de tablas existentes; destino = 'plan' o el código de la cobertura. */
  const [buscadorDlg, setBuscadorDlg] = useState<{ destino: string; etiqueta: string; valor: string; descripcion: string } | null>(
    null,
  );
  /** Catálogo de parentescos (maparent) para mostrar nombres en el resumen. */
  const [parentescosCat, setParentescosCat] = useState<Parentesco[]>([]);
  /** Tablas de tasas usadas por el combo (para «Así se calculará»). */
  const [tablasLeidas, setTablasLeidas] = useState<Record<string, TablaEdad | 'cargando' | 'error'>>({});

  const [cplan, setCplan] = useState(inicio?.cplan ?? '');
  const [xplan, setXplan] = useState(inicio?.xplan ?? '');
  const [fdesde, setFdesde] = useState(inicio?.fdesde || hoyIso());
  const [fhasta, setFhasta] = useState(inicio?.fhasta || '2099-12-31');
  const [cmoneda, setCmoneda] = useState(inicio?.cmoneda || '$');
  const [monedas, setMonedas] = useState<Array<{ codigo: string; nombre: string }>>([]);
  const [frecuencias, setFrecuencias] = useState<string[]>(Array.isArray(inicio?.frecuencias) ? inicio.frecuencias : ['A']);
  /** Frecuencias que el plan ya tiene y no están en la lista base (p. ej. por días): se conservan al editar. */
  const [frecuenciasExtra, setFrecuenciasExtra] = useState<Frecuencia[]>([]);
  const [observacion, setObservacion] = useState(inicio?.observacion ?? '');
  /** Quién puede ofrecer el plan: lista de productores (por defecto 80080) o todos. */
  const [productoresSel, setProductoresSel] = useState<ProductoresSelection>(inicio?.productoresSel ?? PRODUCTORES_DEFAULT);
  /** Canales alternos (mausuplan C): solo si el servidor lo habilita (SIS2000_PLAN_CANALES). */
  const [canalesSel, setCanalesSel] = useState<CanalesSelection>(inicio?.canalesSel ?? CANALES_DEFAULT);
  const [canalesHabilitados, setCanalesHabilitados] = useState(false);

  // ── Edición de un plan existente ──
  const [planOriginal, setPlanOriginal] = useState<PlanOriginal | null>(null);
  const [cargandoPlan, setCargandoPlan] = useState(modoEdicion);
  const [errorPlan, setErrorPlan] = useState<ErrorEntendible | string | null>(null);
  /** Sube con «Reintentar» al leer el plan que se edita. */
  const [recargaPlan, setRecargaPlan] = useState(0);
  /** Sube con «Reintentar» en las tarifas que no se pudieron leer. */
  const [reintentoTarifas, setReintentoTarifas] = useState(0);
  /** ids de campos que el usuario ya dejó (se validan al salir, no mientras escribe). */
  const [tocados, setTocados] = useState<Set<string>>(() => new Set());
  /** Coberturas con algún campo de precio ya tocado. */
  const [cobTocadas, setCobTocadas] = useState<Set<string>>(() => new Set());
  /** Producto del plan leído: se elige cuando llega el catálogo de productos. */
  const [productoPlan, setProductoPlan] = useState<{ cproducto: string; cramo: number } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [versionHistorial, setVersionHistorial] = useState(0);

  useEffect(() => {
    void api
      .getSis2000Funciones()
      .then((f) => setCanalesHabilitados(f.canalesEnPlan === true))
      .catch(() => setCanalesHabilitados(false));
  }, []);

  const [intentoCrear, setIntentoCrear] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [errorCrear, setErrorCrear] = useState<ErrorEntendible | null>(null);
  const [planGuardado, setPlanGuardado] = useState<PlanGuardado | null>(null);
  /** Cambia solo al empezar otro plan tras uno ya creado: así los proveedores pendientes no se pierden al crear. */
  const [proveedoresKey, setProveedoresKey] = useState(0);
  const [cotizando, setCotizando] = useState(false);
  const [errorCotizar, setErrorCotizar] = useState<ErrorEntendible | string | null>(null);
  const [cotizacion, setCotizacion] = useState<Sis2000NestRow[] | null>(null);
  const { activas: ayudasActivas } = useAyudas();
  // Vista con ayudas: los mismos avisos de pantalla, repetidos como aviso complementario (no los reemplaza).
  useAvisoComplementario(planGuardado ? `Plan ${planGuardado.cplan} guardado en Sis2000.` : null, 'exito');
  useAvisoComplementario(errorCrear?.mensaje, 'error');
  useAvisoComplementario(avisoProducto, 'exito');
  useAvisoComplementario(avisoCobertura, 'exito');

  async function cargarProductos() {
    setCargandoProductos(true);
    setErrorProductos(null);
    try {
      setProductos(await api.listSis2000Products());
    } catch (e) {
      setErrorProductos(entenderError(e));
    } finally {
      setCargandoProductos(false);
    }
  }

  useEffect(() => {
    void cargarProductos();
    api
      .listSis2000CatalogMonedas()
      .then((rows) => setMonedas(opcionesMoneda(rows)))
      .catch(() => undefined);
    api
      .listSis2000Ramos()
      .then((rows) =>
        setRamosSis2000(
          (Array.isArray(rows) ? rows : [])
            .map((r) => ({ cramo: Number(r.cramo), xdescripcion: texto(r.xdescripcion) }))
            .filter((r) => r.cramo > 0),
        ),
      )
      .catch(() => setRamosSis2000([]));
  }, []);

  // Editar: lee el plan completo de Sis2000 y llena el formulario.
  useEffect(() => {
    if (!editId) return;
    let vigente = true;
    setCargandoPlan(true);
    setErrorPlan(null);
    api
      .leerSis2000Plan(editId)
      .then((leido) => {
        if (!vigente) return;
        const plan = (leido?.plan ?? {}) as Record<string, unknown>;
        const f = planAFormulario(plan, texto(leido?.type));
        if (!f.cramo || !f.cproducto) {
          setErrorPlan('El plan leído de Sis2000 no trae ramo o producto: no se puede editar con el formulario.');
          return;
        }
        borradorFilas.current = { cramo: f.cramo, filas: f.filas, filasPer: f.filasPer, conservar: true };
        setTipoPlan(f.tipo);
        setAutomovil(false);
        setRamoFiltro(String(f.cramo));
        setProductoPlan({ cproducto: f.cproducto, cramo: f.cramo });
        setCplan(texto(plan.cplan));
        setXplan(texto(plan.xplan));
        setFdesde(texto(plan.fdesde).slice(0, 10) || hoyIso());
        setFhasta(texto(plan.fhasta).slice(0, 10) || '2099-12-31');
        setCmoneda(texto(plan.cmoneda) || '$');
        setObservacion(texto(plan.xobservacion));
        setFrecuencias(f.frecuencias.map((x) => x.ifrecuencia));
        setFrecuenciasExtra(f.frecuencias.filter((x) => !FRECUENCIAS.some((b) => b.ifrecuencia === x.ifrecuencia)));
        setProductoresSel(f.productores);
        setCanalesSel(f.canales);
        if (f.personas) {
          setParentescosTxt(f.personas.cparens.join(', '));
          setCsexo(f.personas.csexo);
          setEdadMin(String(f.personas.min));
          setEdadMax(String(f.personas.max));
        }
        setTablaPlan('');
        setPlanOriginal({
          plan,
          tipo: f.tipo,
          coberturas: Object.keys(f.filas),
          advertencias: Array.isArray(leido?.advertencias) ? leido.advertencias : [],
          bloqueo: f.bloqueo,
        });
      })
      .catch((e) => {
        if (vigente) setErrorPlan(entenderError(e, { que: 'un plan' }));
      })
      .finally(() => {
        if (vigente) setCargandoPlan(false);
      });
    return () => {
      vigente = false;
    };
  }, [editId, recargaPlan]);

  const opcionesProducto = useMemo(() => agruparProductosSis2000(productos), [productos]);

  // Editar: elige el producto del plan cuando llega el catálogo (si no aparece, queda uno provisional).
  useEffect(() => {
    if (!productoPlan || cargandoProductos) return;
    const op = opcionesProducto.find(
      (o) => o.cramo === productoPlan.cramo && o.cproducto.toUpperCase() === productoPlan.cproducto.toUpperCase(),
    );
    if (op) {
      setClaveProducto(op.clave);
    } else {
      setProductos((prev) => [...prev, productoProvisional(productoPlan.cproducto, productoPlan.cramo)]);
      setClaveProducto(`${productoPlan.cproducto}|${productoPlan.cramo}`);
    }
    setProductoPlan(null);
  }, [productoPlan, cargandoProductos, opcionesProducto]);

  /** Ramos únicos de los productos, ordenados, para acotar el selector de producto. */
  const ramosDisponibles = useMemo(
    () =>
      [...new Set(opcionesProducto.map((o) => o.cramo).filter((r) => r > 0))].sort((a, b) => a - b),
    [opcionesProducto],
  );
  /** Opciones del selector de ramo: maramos si se pudo leer (más los ramos de productos que no estén); si no, los deducidos. */
  const opcionesRamo = useMemo(() => {
    if (!ramosSis2000.length) return ramosDisponibles.map((r) => ({ cramo: r, etiqueta: `Ramo ${r}` }));
    const conocidos = new Set(ramosSis2000.map((r) => r.cramo));
    return [
      ...ramosSis2000.map((r) => ({
        cramo: r.cramo,
        etiqueta: r.xdescripcion ? `${r.xdescripcion} (${r.cramo})` : `Ramo ${r.cramo}`,
      })),
      ...ramosDisponibles.filter((r) => !conocidos.has(r)).map((r) => ({ cramo: r, etiqueta: `Ramo ${r}` })),
    ].sort((a, b) => a.cramo - b.cramo);
  }, [ramosSis2000, ramosDisponibles]);
  const opcionesProductoFiltradas = useMemo(
    () =>
      ramoFiltro === RAMO_TODOS
        ? opcionesProducto
        : opcionesProducto.filter((o) => String(o.cramo) === ramoFiltro),
    [opcionesProducto, ramoFiltro],
  );
  /** Nombres de producto repetidos en la lista (a esos se les agrega el código para distinguirlos). */
  const nombresRepetidos = useMemo(() => {
    const cuenta = new Map<string, number>();
    opcionesProductoFiltradas.forEach((o) => {
      const n = o.nombre.toUpperCase();
      cuenta.set(n, (cuenta.get(n) ?? 0) + 1);
    });
    return cuenta;
  }, [opcionesProductoFiltradas]);
  /** Opciones del buscador de ramo: «AUTOMOVIL (18)»; se encuentra por nombre o número. */
  const opcionesComboRamo = useMemo<OpcionCombo[]>(
    () => [
      { valor: RAMO_TODOS, etiqueta: 'Todos los ramos' },
      ...opcionesRamo.map((r) => ({ valor: String(r.cramo), etiqueta: r.etiqueta, buscar: String(r.cramo) })),
    ],
    [opcionesRamo],
  );
  /** Opciones del buscador de producto: nombre; se encuentra también por código y ramo. */
  const opcionesComboProducto = useMemo<OpcionCombo[]>(
    () =>
      opcionesProductoFiltradas.map((o) => {
        const nombre = o.nombre || 'Sin nombre';
        const repetido = (nombresRepetidos.get(nombre.toUpperCase()) ?? 0) > 1;
        const detalle = [
          ramoFiltro === RAMO_TODOS && o.cramo ? `ramo ${o.cramo}` : '',
          !o.cramo ? 'sin ramo' : '',
          o.tieneNexus ? 'también en Nexus' : '',
          o.codigoCompartido ? `código ${o.cproducto}` : '',
        ]
          .filter(Boolean)
          .join(' · ');
        return {
          valor: o.clave,
          etiqueta: repetido ? `${nombre} (${o.cproducto})` : nombre,
          detalle: detalle || undefined,
          buscar: `${o.cproducto} ${o.cramo}`,
          deshabilitada: !o.cramo,
        };
      }),
    [opcionesProductoFiltradas, nombresRepetidos, ramoFiltro],
  );
  const opcionProducto = useMemo(
    // Borradores anteriores y el plan en edición guardan cproducto|cramo (sin nombre): vale la primera opción del código.
    () =>
      opcionesProducto.find((o) => o.clave === claveProducto) ??
      (claveProducto ? opcionesProducto.find((o) => o.clave.startsWith(`${claveProducto}|`)) : null) ??
      null,
    [opcionesProducto, claveProducto],
  );
  const producto = opcionProducto?.producto ?? null;
  const cproducto = opcionProducto?.cproducto ?? '';
  const nombreProducto = opcionProducto?.nombre || (cproducto ? `Producto ${cproducto}` : '');
  const cramo = producto && Number(producto.cramo) > 0 ? Number(producto.cramo) : 0;
  const nombreRamo = cramo ? (opcionesRamo.find((r) => r.cramo === cramo)?.etiqueta ?? `Ramo ${cramo}`) : '';
  const esPersonas = texto(producto?.xform).toLowerCase().startsWith('person');
  const esAuto = familiaRamo === 'auto';

  // Familia del ramo (auto, personas o cosas) para sugerir «Automóvil» y avisar si no corresponde.
  useEffect(() => {
    setFamiliaRamo(null);
    setRamoSoloLectura(false);
    setFichaCob(null);
    if (!cramo) return;
    let vigente = true;
    api
      .leerSis2000Ramo(cramo)
      .then((r) => {
        if (!vigente) return;
        const ramo = normalizarRamo(r ?? {});
        setFamiliaRamo(ramo.familia);
        setRamoSoloLectura(ramo.soloLectura);
      })
      .catch(() => {
        if (vigente) setFamiliaRamo(null);
      });
    return () => {
      vigente = false;
    };
  }, [cramo]);

  // ── Completar el plan sin salir del combo (secciones del ramo: GET ramos/:cramo, igual que la ficha) ──
  const navigate = useNavigate();
  const planIdCompletar =
    modoEdicion && editId ? editId : planGuardado ? sis2000PlanMasterId(planGuardado.cramo, planGuardado.cplan) : null;
  const cramoCompletar = cramo || Number((editId ?? '').split('-')[0]) || 0;
  const completar = usePlanCompletar(cramoCompletar, planIdCompletar);
  const gruposPlan = useMemo(
    () => (completar.ramo || completar.errorRamo ? gruposCompletar(completar.ramo?.familia ?? null, completar.ramo?.secciones ?? []) : []),
    [completar.ramo, completar.errorRamo],
  );
  const totalPasos = PASOS.length + gruposPlan.length;
  /** Grupos de «completar» que ya se abrieron (se quedan montados para no perder lo escrito). */
  const [gruposVistos, setGruposVistos] = useState<ReadonlySet<string>>(() => new Set());
  const grupoActivo = paso >= PASOS.length ? (gruposPlan[paso - PASOS.length]?.id ?? null) : null;
  useEffect(() => {
    if (grupoActivo && !gruposVistos.has(grupoActivo)) setGruposVistos((prev) => new Set(prev).add(grupoActivo));
  }, [grupoActivo, gruposVistos]);
  const estadoDeGrupo = (g: (typeof gruposPlan)[number]): EstadoGrupo =>
    estadoGrupo(g, {
      planListo: Boolean(planIdCompletar),
      visitados: gruposVistos,
      items: completar.revision?.items ?? null,
      revisionListo: completar.revision ? completar.revision.listo : null,
    });
  const pasosCompletar: PasoAsistente[] = gruposPlan.map((g) => {
    const e = estadoDeGrupo(g);
    return {
      id: `completar-${g.id}`,
      titulo: g.titulo,
      resumen: g.resumen,
      etiqueta: ETIQUETA_ESTADO[e],
      tono: e === 'hecho' ? 'bien' : e === 'falta' ? 'falta' : e === 'revisar' ? 'aviso' : undefined,
      bloqueo: 'Se habilita al guardar el plan',
    };
  });

  // Borrador en localStorage: se guarda medio segundo después del último cambio (no al editar un plan existente).
  useEffect(() => {
    const t = setTimeout(() => {
      if (sinBorrador.current) return;
      // Mientras el borrador del ramo no se aplicó, se conservan sus filas (las tarifas aún no llegan).
      const pendiente = borradorFilas.current;
      const guardado = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
      guardarBorrador({
        ramoFiltro,
        claveProducto,
        tipoPlan,
        automovil,
        parentescosTxt,
        csexo,
        edadMin,
        edadMax,
        tablaPlan,
        cplan,
        xplan,
        fdesde,
        fhasta,
        cmoneda,
        frecuencias,
        productoresSel,
        canalesSel,
        observacion,
        cramo: cramo || pendiente?.cramo || 0,
        filas: pendiente ? { ...pendiente.filas, ...filas } : filas,
        filasPer: Object.keys(filasPer).length || !pendiente ? filasPer : pendiente.filasPer,
        guardado,
      });
      setUltimoGuardado(guardado);
    }, 500);
    return () => clearTimeout(t);
  }, [
    ramoFiltro, claveProducto, tipoPlan, automovil, parentescosTxt, csexo, edadMin, edadMax, tablaPlan, cplan, xplan, fdesde,
    fhasta, cmoneda, frecuencias, productoresSel, canalesSel, observacion, cramo, filas, filasPer,
  ]);

  /** Empieza un combo nuevo: borra el borrador y recarga la pantalla limpia. */
  function empezarDeCero(preguntar = true) {
    if (preguntar && !window.confirm('¿Borrar todo lo llenado y empezar un plan nuevo?')) return;
    sinBorrador.current = true;
    borrarBorrador();
    window.location.reload();
  }

  // Coberturas del ramo (macoberturas, orden numérico del servidor).
  useEffect(() => {
    generacion.current += 1;
    const gen = generacion.current;
    solicitadas.current = new Set();
    setCatalogo(null);
    setTarifas({});
    setFilas({});
    setFilasPer({});
    setSumaConfig({});
    setEditandoSuma(null);
    setErrorCoberturas(null);
    if (!cramo) {
      setCargandoCoberturas(false);
      return;
    }
    // Borrador: solo se reaplica en el mismo ramo; en otro ramo se descarta (evita coberturas de otro producto).
    const borrador = borradorFilas.current;
    if (borrador && borrador.cramo !== cramo) borradorFilas.current = null;
    else if (borrador) setFilasPer(borrador.filasPer);
    setCargandoCoberturas(true);
    // La configuración de suma es propia del configurador: si falla, las coberturas se tratan como FIJA.
    api
      .listSis2000CoberturaSumaConfig(cramo)
      .then((rows) => {
        if (gen === generacion.current) setSumaConfig(indexarSumaConfig(rows));
      })
      .catch(() => undefined);
    api
      .listSis2000CoberturasByRamo(cramo)
      .then((rows) => {
        if (gen !== generacion.current) return;
        const coberturas = rows.map(aCoberturaRamo).filter((c) => c.ccobertura);
        setCatalogo({ cramo, coberturas });
        // Con borrador del mismo ramo se respeta la moneda que el usuario ya había elegido.
        if (!borradorFilas.current) setCmoneda(monedaDelRamo(coberturas));
      })
      .catch((e) => {
        if (gen !== generacion.current) return;
        setErrorCoberturas(entenderError(e));
      })
      .finally(() => {
        if (gen === generacion.current) setCargandoCoberturas(false);
      });
  }, [cramo, recarga]);

  /** Coberturas que ya tiene el plan que se edita (no se pueden quitar desde aquí). */
  const delPlan = useMemo(() => new Set(planOriginal?.coberturas ?? []), [planOriginal]);

  const visibles = useMemo(() => {
    if (!catalogo || catalogo.cramo !== cramo) return [];
    // Las del plan que se edita se muestran aunque estén inactivas en el ramo.
    return mostrarInactivas
      ? catalogo.coberturas
      : catalogo.coberturas.filter((c) => !c.inactiva || delPlan.has(c.ccobertura));
  }, [catalogo, cramo, mostrarInactivas, delPlan]);

  // Tarifas (matarifa + matarifa_d) de cada cobertura visible, como mucho TARIFAS_EN_PARALELO a la vez.
  useEffect(() => {
    if (!catalogo || catalogo.cramo !== cramo) return;
    const ramo = catalogo.cramo;
    const gen = generacion.current;
    const pendientes = visibles.filter((c) => !solicitadas.current.has(c.ccobertura));
    if (!pendientes.length) return;
    pendientes.forEach((c) => solicitadas.current.add(c.ccobertura));
    setTarifas((prev) => {
      const next = { ...prev };
      pendientes.forEach((c) => {
        next[c.ccobertura] = { estado: 'cargando' };
      });
      return next;
    });
    void enParalelo(pendientes, TARIFAS_EN_PARALELO, async (c) => {
      if (gen !== generacion.current) return;
      try {
        const rows = await api.listSis2000Tarifas(ramo, c.ccobertura);
        if (gen !== generacion.current) return;
        setTarifas((prev) => ({ ...prev, [c.ccobertura]: { estado: 'ok', tarifas: rows } }));
        setFilas((prev) => {
          if (prev[c.ccobertura]) return prev;
          // Borrador del mismo ramo: se recupera lo marcado y los montos si la tarifa sigue vigente.
          // Plan que se edita: se conserva siempre (si la tarifa venció, se avisa en «Tarifas y tasas»).
          const b = borradorFilas.current?.cramo === ramo ? borradorFilas.current : null;
          const guardada = b?.filas[c.ccobertura];
          if (guardada && (b?.conservar || rows.some((t) => esVigente(t) && texto(t.ctarifa) === guardada.ctarifa))) {
            return { ...prev, [c.ccobertura]: normalizarFila(guardada) };
          }
          const fila = filaInicial(c.ccobertura, rows, hoy);
          // Al editar, las coberturas que no son del plan entran sin marcar (solo se agrega lo que el usuario elija).
          if (b?.conservar) fila.incluir = false;
          // Cobertura recién creada desde esta pantalla: entra marcada en el combo.
          if (porIncluir.current.delete(c.ccobertura) && fila.ctarifa) fila.incluir = true;
          return { ...prev, [c.ccobertura]: fila };
        });
      } catch (e) {
        if (gen !== generacion.current) return;
        setTarifas((prev) => ({
          ...prev,
          [c.ccobertura]: {
            estado: 'error',
            error: mensajeDeError(e),
          },
        }));
      }
    });
  }, [catalogo, cramo, visibles, hoy, reintentoTarifas]);

  /** Vuelve a pedir las tarifas que fallaron (sin tocar lo ya marcado). */
  function reintentarTarifas() {
    Object.entries(tarifas).forEach(([cc, t]) => {
      if (t.estado === 'error') solicitadas.current.delete(cc);
    });
    setReintentoTarifas((n) => n + 1);
  }

  const vistas = useMemo<VistaCobertura[]>(
    () =>
      visibles.map((cobertura) => {
        const carga = tarifas[cobertura.ccobertura];
        const vigentes = carga?.estado === 'ok' ? carga.tarifas.filter(esVigente) : [];
        const fila = filas[cobertura.ccobertura];
        // La tarifa de la fila debe estar vigente: si venció (plan viejo), no se reemplaza por otra en silencio.
        const tarifa = fila?.ctarifa
          ? vigentes.find((t) => texto(t.ctarifa) === fila.ctarifa)
          : vigentes[0];
        const config = sumaConfig[cobertura.ccobertura.toUpperCase()];
        return {
          cobertura,
          carga,
          vigentes,
          tarifa,
          fila,
          obligatoria: esObligatoria(tarifa ?? vigentes[0], cobertura.ccobertura),
          sumaConfig: config,
          calculada: esSumaCalculada(config),
        };
      }),
    [visibles, tarifas, filas, sumaConfig],
  );

  const incluidas = useMemo(
    () => vistas.filter((v): v is VistaIncluida => Boolean(v.fila?.incluir && v.tarifa)),
    [vistas],
  );

  /** Coberturas del plan que se edita que no pueden entrar (tarifa vencida, sin tarifa o fuera del ramo). */
  const delPlanConProblema = useMemo(() => {
    // Solo con el catálogo del ramo ya leído (antes, todas parecerían «fuera del ramo»).
    if (!planOriginal || !catalogo || catalogo.cramo !== cramo || cargandoCoberturas) return [];
    return planOriginal.coberturas
      .map((cc) => ({ cc, vista: vistas.find((v) => v.cobertura.ccobertura === cc) }))
      .filter(
        ({ vista }) =>
          !vista || (Boolean(vista.carga) && vista.carga?.estado !== 'cargando' && !(vista.fila?.incluir && vista.tarifa)),
      );
  }, [planOriginal, catalogo, cramo, cargandoCoberturas, vistas]);

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = soloMarcadas ? vistas.filter((v) => v.fila?.incluir) : vistas;
    if (!q) return base;
    return base.filter((v) => JSON.stringify(v.cobertura.fila).toLowerCase().includes(q));
  }, [vistas, search, soloMarcadas]);

  const totalTarifas = Object.keys(tarifas).length;
  const tarifasListas = Object.values(tarifas).filter((t) => t.estado !== 'cargando').length;
  const cargandoTarifas = tarifasListas < totalTarifas;
  const inactivas = catalogo?.coberturas.filter((c) => c.inactiva).length ?? 0;
  const sinTarifa = vistas.filter((v) => v.carga?.estado === 'ok' && !v.vigentes.length).length;
  const nombreCob = (v: VistaCobertura) => v.cobertura.descripcion || `Cobertura sin nombre (${v.cobertura.ccobertura})`;

  function cambiarFila(ccobertura: string, cambios: Partial<FilaCombo>) {
    setFilas((prev) => {
      const actual = prev[ccobertura];
      return actual ? { ...prev, [ccobertura]: { ...actual, ...cambios } } : prev;
    });
  }

  /** Otra tarifa vigente: se vuelven a tomar sumas, tasa y prima de su detalle vigente. */
  function cambiarTarifa(v: VistaCobertura, ctarifa: string) {
    // Plan existente con la tarifa vencida: solo se reemplaza la tarifa y se conservan los montos del plan.
    if (!v.tarifa) {
      cambiarFila(v.cobertura.ccobertura, { ctarifa });
      return;
    }
    const tarifa = v.vigentes.find((t) => texto(t.ctarifa) === ctarifa);
    cambiarFila(v.cobertura.ccobertura, valoresDeTarifa(tarifa, hoy));
  }

  /** Monedas del catálogo; si la sugerida no está en la lista, se agrega para que el select la muestre. */
  const opcionesDeMoneda = useMemo(() => {
    const actual = cmoneda.trim();
    return actual && !monedas.some((m) => m.codigo === actual)
      ? [{ codigo: actual, nombre: '' }, ...monedas]
      : monedas;
  }, [monedas, cmoneda]);

  const opcionesFrecuencia = useMemo(() => [...FRECUENCIAS, ...frecuenciasExtra], [frecuenciasExtra]);

  function alternarFrecuencia(ifrecuencia: string, marcada: boolean) {
    setFrecuencias((prev) => {
      const sin = prev.filter((f) => f !== ifrecuencia);
      return marcada ? [...sin, ifrecuencia] : sin;
    });
  }

  /** Prima de referencia de una cobertura de cosas con la suma máxima (0 si la suma se calcula al emitir). */
  function primaReferencia(v: VistaIncluida): number {
    if (v.calculada) return 0;
    const suma = numero(v.fila.msumamax);
    return v.fila.modo === 'tasa' ? (suma * numero(v.fila.pprima)) / 100 : numero(v.fila.mprima);
  }

  /** Referencia con las sumas máximas: tasa × suma ÷ 100 o la prima fija, según lo elegido. */
  const resumen = useMemo(() => {
    let sumaMaxima = 0;
    let prima = 0;
    for (const v of incluidas) {
      if (personas) {
        // Personas: suma y prima por persona tal cual; la tasa por edad la aplica Sis2000.
        sumaMaxima = Math.max(sumaMaxima, numero(v.fila.msumamax));
        prima += numero(v.fila.mprima);
        continue;
      }
      if (v.calculada) continue; // la suma llega al emitir
      sumaMaxima = Math.max(sumaMaxima, numero(v.fila.msumamax));
      prima += primaReferencia(v);
    }
    return { sumaMaxima, prima };
    // primaReferencia solo lee la fila de cada vista
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incluidas, personas]);

  const filaPer = (ccobertura: string) => filasPer[ccobertura] ?? FILA_PERSONAS;

  function cambiarFilaPer(ccobertura: string, cambios: Partial<FilaPersonas>) {
    setFilasPer((prev) => ({ ...prev, [ccobertura]: { ...(prev[ccobertura] ?? FILA_PERSONAS), ...cambios } }));
  }

  /** Tabla de tasas de la cobertura: la suya o, si está vacía, la del plan. */
  const tablaDe = (ccobertura: string) => filaPer(ccobertura).ctablatar.trim() || tablaPlan.trim();

  /** Nombre de la tabla para mostrar: «Descripción (CÓDIGO)» si ya se leyó. */
  function nombreTabla(codigo: string): string {
    const t = tablasLeidas[codigo.toUpperCase()];
    return t && t !== 'cargando' && t !== 'error' && texto(t.xtablaedad) ? `${texto(t.xtablaedad)} (${codigo})` : codigo;
  }

  /** Abre «Crear tabla» con un código sugerido (plan, o plan + cobertura; máx. 10) y la descripción del plan/cobertura. */
  function abrirCrearTabla(destino: string, descripcionCobertura = '', codigoSugerido = '') {
    const base = cplan.trim().toUpperCase();
    const codigo = (codigoSugerido.trim() || (destino === 'plan' ? base : `${base}${destino.trim().toUpperCase()}`)).slice(0, 10);
    const descripcion = [xplan.trim(), descripcionCobertura.trim()].filter(Boolean).join(' · ').slice(0, 60);
    setTablaDlg({ modo: 'crear', destino, codigo, descripcion });
  }

  function abrirVerTabla(codigo: string) {
    if (codigo.trim()) setTablaDlg({ modo: 'ver', destino: '', codigo: codigo.trim(), descripcion: '' });
  }

  /** Abre el buscador de tablas existentes para el plan o una cobertura. */
  function abrirBuscadorTabla(destino: string, descripcionCobertura = '') {
    const etiqueta =
      destino === 'plan'
        ? 'Tabla del plan (la usan las coberturas que no tengan otra)'
        : descripcionCobertura || 'Cobertura';
    const valor = destino === 'plan' ? tablaPlan : filaPer(destino).ctablatar || tablaPlan;
    setBuscadorDlg({ destino, etiqueta, valor, descripcion: descripcionCobertura });
  }

  /** Asigna la tabla elegida; «en todas» la pone como tabla del plan y en cada cobertura incluida. */
  function asignarTabla(destino: string, codigo: string, enTodas: boolean) {
    if (enTodas) {
      setTablaPlan(codigo);
      setFilasPer((prev) => {
        const next = { ...prev };
        incluidas.forEach((v) => {
          next[v.cobertura.ccobertura] = { ...(prev[v.cobertura.ccobertura] ?? FILA_PERSONAS), ctablatar: codigo };
        });
        return next;
      });
      return;
    }
    if (destino === 'plan') setTablaPlan(codigo);
    else cambiarFilaPer(destino, { ctablatar: codigo });
  }

  /** Quita la tabla propia de cada cobertura: todas usan la del plan. */
  function usarTablaDelPlanEnTodas() {
    setFilasPer((prev) => {
      const next: Record<string, FilaPersonas> = {};
      Object.entries(prev).forEach(([k, v]) => {
        next[k] = { ...v, ctablatar: '' };
      });
      return next;
    });
  }

  /** Suma asegurada cerrada: mínima = máxima. */
  function igualarSuma(ccobertura: string) {
    setFilas((prev) => {
      const actual = prev[ccobertura];
      return actual ? { ...prev, [ccobertura]: { ...actual, msumamin: actual.msumamax } } : prev;
    });
  }

  /** Códigos de tabla que usa el combo de personas (para leer sus tramos y explicar el cálculo). */
  const tablasDelCombo = useMemo(
    () =>
      personas
        ? [...new Set(incluidas.map((v) => (filasPer[v.cobertura.ccobertura]?.ctablatar ?? '').trim() || tablaPlan.trim()))]
            .filter(Boolean)
            .map((c) => c.toUpperCase())
        : [],
    [personas, incluidas, filasPer, tablaPlan],
  );

  useEffect(() => {
    const faltan = tablasDelCombo.filter((c) => tablasLeidas[c] === undefined);
    if (!faltan.length) return;
    const t = setTimeout(() => {
      setTablasLeidas((prev) => {
        const next = { ...prev };
        faltan.forEach((c) => {
          if (next[c] === undefined) next[c] = 'cargando';
        });
        return next;
      });
      faltan.forEach((c) => {
        api
          .leerSis2000TablaEdad(c)
          .then((tab) => setTablasLeidas((prev) => ({ ...prev, [c]: tab })))
          .catch(() => setTablasLeidas((prev) => ({ ...prev, [c]: 'error' })));
      });
    }, 600);
    return () => clearTimeout(t);
  }, [tablasDelCombo, tablasLeidas]);

  function sumaCerradaEnTodas() {
    setFilas((prev) => {
      const next = { ...prev };
      incluidas.forEach((v) => {
        const actual = prev[v.cobertura.ccobertura];
        if (actual && !v.calculada) next[v.cobertura.ccobertura] = { ...actual, msumamin: actual.msumamax };
      });
      return next;
    });
  }

  /** cparen escritos («1» o «1, 2, 3»); null si alguno no es un entero ≥ 1. */
  const cparens = useMemo(() => {
    const partes = parentescosTxt.split(',').map((x) => x.trim()).filter(Boolean);
    const nums = partes.map((x) => entero(x));
    return nums.length && nums.every((x) => x != null && x >= 1) ? (nums as number[]) : null;
  }, [parentescosTxt]);

  /** 'cosas', 'personas' o 'automovil' (este último se graba como cosas). */
  function cambiarTipoPlan(valor: string) {
    setTipoPlan(valor === 'personas' ? 'personas' : 'cosas');
    setAutomovil(valor === 'automovil');
    setEditandoSuma(null);
    setIntentoCrear(false);
    limpiarResultado();
  }

  /** PlanDto (cosas o personas) con las coberturas incluidas, listo para POST/PUT /core/sis2000/plans. */
  function armarPayload(): Record<string, unknown> {
    const payload = defaultPlanPayload({
      type: tipoPlan,
      cramo,
      cproducto,
      cplan: cplan.trim(),
      ...productoresToPayloadFields(productoresSel),
    });
    // Al editar se conservan los datos de cabecera que el formulario no muestra (renovación, devolución, etc.).
    if (planOriginal) {
      const conservados: Record<string, unknown> = {};
      CABECERA_CONSERVADA.forEach((k) => {
        const v = planOriginal.plan[k];
        if (v !== undefined && v !== null && v !== '') conservados[k] = v;
      });
      Object.assign(payload, conservados);
    }
    payload.xplan = xplan.trim();
    payload.fdesde = fdesde;
    payload.fhasta = fhasta;
    payload.cmoneda = cmoneda.trim();
    payload.all_productor = productoresSel.todos;
    payload.xobservacion = observacion.trim() || undefined;
    if (canalesHabilitados) Object.assign(payload, canalesToPayloadFields(canalesSel));
    payload.frecuencias = opcionesFrecuencia
      .filter((f) => frecuencias.includes(f.ifrecuencia))
      .map((f) => ({ ...f }));
    if (personas) {
      // Personas: cada cobertura lleva sus parentescos con edades, tabla de tasas, suma y prima.
      payload.coberturas = incluidas.map((v) => ({
        ccobertura: v.cobertura.ccobertura,
        ctarifa: v.fila.ctarifa,
        bobligatoria: filaPer(v.cobertura.ccobertura).obligatoria,
        parentescos: (cparens ?? []).map((cparen) => ({
          cparen,
          csexo,
          ctablatar: tablaDe(v.cobertura.ccobertura),
          nedad_min: entero(edadMin) ?? 0,
          nedad_max: entero(edadMax) ?? 0,
          msuma: numero(v.fila.msumamax),
          msumamax: numero(v.fila.msumamax),
          mprima: numero(v.fila.mprima),
        })),
      }));
      return normalizePlanPayloadForApi({ ...payload }, modoEdicion ? 'update' : 'create');
    }
    payload.coberturas = incluidas.map((v) =>
      v.calculada
        ? // Suma calculada al emitir: se graba en 0 y nest-api no exige suma ni prima/tasa.
          {
            ccobertura: v.cobertura.ccobertura,
            ctarifa: v.fila.ctarifa,
            msumamin: 0,
            msumamax: 0,
            mprima: 0,
            pprima: 0,
            suma_calculada: true,
          }
        : {
            ccobertura: v.cobertura.ccobertura,
            ctarifa: v.fila.ctarifa,
            msumamin: numero(v.fila.msumamin),
            msumamax: numero(v.fila.msumamax),
            // Tasa y prima fija son excluyentes: solo se graba la elegida; la otra va en 0.
            mprima: v.fila.modo === 'prima' ? numero(v.fila.mprima) : 0,
            pprima: v.fila.modo === 'tasa' ? numero(v.fila.pprima) : 0,
          },
    );
    return normalizePlanPayloadForApi({ ...payload }, modoEdicion ? 'update' : 'create');
  }

  /** Lo que nest-api rechazaría, dicho por cobertura y con el paso donde se corrige. */
  function validarCombo(): Falta[] {
    const faltas: Falta[] = [];
    const falta = (p: PasoId, t: string, campo?: string, cob?: string) => faltas.push({ paso: p, texto: t, campo, cob });

    if (modoEdicion && cargandoPlan) falta('producto', 'Espera a que termine de leerse el plan de Sis2000.');
    if (errorPlan) falta('producto', 'No se pudo leer el plan de Sis2000.');
    if (planOriginal?.bloqueo) falta('producto', planOriginal.bloqueo);
    if (!producto) falta('producto', 'Elige el producto (escribe su nombre o código en «Producto»).', 'combo-producto');

    if (producto && !incluidas.length) falta('coberturas', 'Marca al menos una cobertura para el plan.', 'combo-tabla-coberturas');
    if (cramo && cargandoTarifas) falta('coberturas', 'Espera a que terminen de cargarse las tarifas de las coberturas.');
    for (const { cc, vista } of delPlanConProblema) {
      falta(
        'precios',
        !vista
          ? `Una cobertura del plan (${cc}) ya no aparece en el ramo: no se puede guardar sin perderla. Usa el modo avanzado o pide revisarla a Técnico.`
          : vista.vigentes.length
            ? `«${nombreCob(vista)}»: la tarifa que tenía el plan ya no está vigente. Elige una de las vigentes.`
            : `«${nombreCob(vista)}»: no tiene ninguna tarifa vigente. Pide a Técnico renovarla antes de guardar el plan.`,
        vista && vista.vigentes.length ? `p-tarifa-${cc}` : undefined,
        cc,
      );
    }

    if (personas) {
      const min = entero(edadMin);
      const max = entero(edadMax);
      if (!cparens) falta('precios', 'Marca al menos un parentesco en «¿Quiénes se aseguran?» (por ejemplo, Titular).', 'combo-cparen-texto');
      else if (new Set(cparens).size !== cparens.length) falta('precios', 'Hay parentescos repetidos: deja cada uno una sola vez.', 'combo-cparen-texto');
      if (min == null) falta('precios', 'Escribe la edad mínima en años, sin decimales (por ejemplo, 0).', 'combo-edad-min');
      if (max == null) falta('precios', 'Escribe la edad máxima en años, sin decimales (por ejemplo, 74).', 'combo-edad-max');
      if (min != null && max != null && min > max) {
        falta('precios', `La edad mínima (${min}) es mayor que la máxima (${max}). Inviértelas.`, 'combo-edad-min');
      }
      for (const v of incluidas) {
        const n = `«${nombreCob(v)}»`;
        const tabla = tablaDe(v.cobertura.ccobertura);
        const cc = v.cobertura.ccobertura;
        if (!tabla) falta('precios', `${n}: elige su tabla de precios por edad («Elegir») o una para todas arriba.`, `per-tabla-${cc}`, cc);
        else if (tabla.length > 10) falta('precios', `${n}: el código de la tabla admite hasta 10 caracteres.`, `per-tabla-${cc}`, cc);
        if (numero(v.fila.msumamax) < 0) falta('precios', `${n}: la suma asegurada no puede ser negativa.`, `per-suma-${cc}`, cc);
        if (numero(v.fila.mprima) < 0) falta('precios', `${n}: la prima por persona no puede ser negativa (déjala en 0).`, `per-prima-${cc}`, cc);
      }
    } else {
      for (const v of incluidas) {
        const n = `«${nombreCob(v)}»`;
        if (v.calculada) continue; // suma, tasa y prima llegan al emitir
        const min = numero(v.fila.msumamin);
        const max = numero(v.fila.msumamax);
        const tasa = numero(v.fila.pprima);
        const prima = numero(v.fila.mprima);
        const cc = v.cobertura.ccobertura;
        if (!(max > 0)) falta('precios', `${n}: escribe la suma asegurada máxima, mayor a 0 (por ejemplo, 50.000).`, `p-max-${cc}`, cc);
        if (min < 0) falta('precios', `${n}: la suma mínima no puede ser negativa (déjala en 0).`, `p-min-${cc}`, cc);
        else if (max > 0 && min > max) {
          falta(
            'precios',
            `${n}: la suma mínima (${miles(min)}) no puede ser mayor que la máxima (${miles(max)}). Inviértelas o, si es una suma fija, pon el mismo monto en ambas.`,
            `p-min-${cc}`,
            cc,
          );
        }
        if (v.fila.modo === 'tasa' && !(tasa > 0)) {
          falta('precios', `${n}: escribe la tasa en %, mayor a 0 (por ejemplo, 0.5). Si cobra un monto fijo, elige «Prima fija».`, `p-valor-${cc}`, cc);
        } else if (v.fila.modo === 'tasa' && tasa > 100) {
          falta('precios', `${n}: la tasa ${miles(tasa)} % es más de 100 %. Revisa el número o elige «Prima fija».`, `p-valor-${cc}`, cc);
        }
        if (v.fila.modo === 'prima' && !(prima > 0)) {
          falta('precios', `${n}: escribe la prima fija, mayor a 0 (por ejemplo, 25). Si cobra un % de la suma, elige «Tasa %».`, `p-valor-${cc}`, cc);
        }
      }
      const basica = incluidas.find((v) => v.cobertura.ccobertura === '1');
      if (basica) {
        const maxBasica = numero(basica.fila.msumamax);
        for (const v of incluidas) {
          if (v === basica || v.obligatoria || v.calculada) continue;
          const max = numero(v.fila.msumamax);
          if (max > maxBasica) {
            falta(
              'precios',
              `«${nombreCob(v)}» es opcional y su suma máxima (${miles(max)}) supera la de la cobertura básica «${nombreCob(basica)}» (${miles(maxBasica)}). Bájala o sube la de la básica.`,
              `p-max-${v.cobertura.ccobertura}`,
              v.cobertura.ccobertura,
            );
          }
        }
      }
    }

    const codigo = cplan.trim();
    if (!xplan.trim()) falta('datos', 'Escribe el nombre del plan, como lo verán SysIP y la emisión.', 'combo-xplan');
    else if (xplan.trim().length > 60) falta('datos', `El nombre tiene ${xplan.trim().length} caracteres; el máximo es 60. Acórtalo.`, 'combo-xplan');
    if (!codigo) falta('datos', 'Escribe el código del plan: hasta 6 letras o números (por ejemplo, RCG01).', 'combo-cplan');
    else if (codigo.length > 6) falta('datos', `El código tiene ${codigo.length} caracteres; el máximo es 6.`, 'combo-cplan');
    if (!fdesde) falta('datos', 'Elige desde qué fecha se puede emitir.', 'combo-fdesde');
    if (!fhasta) falta('datos', 'Elige hasta qué fecha se puede emitir (31/12/2099 si no tiene fin).', 'combo-fhasta');
    if (fdesde && fhasta && fdesde > fhasta) {
      falta('datos', `La fecha «desde» (${fechaCorta(fdesde)}) es posterior a «hasta» (${fechaCorta(fhasta)}). Corrígelas.`, 'combo-fhasta');
    }
    if (!cmoneda.trim()) falta('datos', 'Elige la moneda del plan.', 'combo-cmoneda');
    if (!frecuencias.length) falta('datos', 'Marca al menos una forma de pago (anual, mensual…).', 'combo-frecuencias');
    if (observacion.trim().length > 255) {
      falta('datos', `Las observaciones tienen ${observacion.trim().length} caracteres; el máximo es 255.`, 'combo-xobservacion');
    }
    const errorProductores = validarProductores(productoresSel);
    if (errorProductores) falta('datos', errorProductores, 'combo-prod-buscar');

    if (!faltas.length) validatePlanPayload(armarPayload()).forEach((t) => falta('revisar', t));
    return faltas;
  }

  const faltas = validarCombo();
  const errores = faltas.map((f) => f.texto);
  const faltasDe = (i: number) => faltas.filter((f) => f.paso === PASOS[i].id);
  /** Mensaje del campo si ya se tocó o se intentó avanzar/guardar. */
  const errorDe = (id: string) =>
    intentoCrear || tocados.has(id) ? faltas.find((f) => f.campo === id)?.texto : undefined;
  const faltasCob = (cc: string) => faltas.filter((f) => f.cob === cc).map((f) => f.texto);

  /** Al salir de un campo: queda «tocado» (desde ahí muestra su error). */
  function registrarBlur(e: React.FocusEvent<HTMLElement>) {
    const el = e.target as HTMLElement;
    if (el.id && !tocados.has(el.id)) setTocados((prev) => new Set(prev).add(el.id));
    const cob = el.dataset?.cob;
    if (cob && !cobTocadas.has(cob)) setCobTocadas((prev) => new Set(prev).add(cob));
  }

  /** Lleva al campo aunque esté en otro paso: cambia de paso y después enfoca. */
  function irACampoDelPaso(id: string) {
    const el = document.getElementById(id);
    const contenedor = el?.closest<HTMLElement>('[data-paso]');
    const i = contenedor ? Number(contenedor.dataset.paso) : -1;
    if (i >= 0 && i !== paso) {
      setPaso(i);
      setAvisoPaso(null);
      window.setTimeout(() => irACampo(id), 60);
    } else {
      irACampo(id);
    }
  }

  /** Primer paso con cosas pendientes (hasta ahí se puede llegar con la barra). */
  const limitePasos = (() => {
    for (let i = 0; i < PASOS.length - 1; i += 1) if (faltasDe(i).length) return i;
    return PASOS.length - 1;
  })();

  function estadoPaso(i: number): EstadoPaso {
    if (i === paso) return 'actual';
    if (i >= PASOS.length) {
      const e = estadoDeGrupo(gruposPlan[i - PASOS.length]);
      return e === 'bloqueado' ? 'bloqueado' : e === 'hecho' ? 'hecho' : 'pendiente';
    }
    if (i > limitePasos && i > paso) return 'bloqueado';
    if (i === PASOS.length - 1) return planGuardado ? 'hecho' : 'pendiente';
    return faltasDe(i).length ? 'pendiente' : 'hecho';
  }

  function irAPaso(i: number) {
    const destino = Math.max(0, Math.min(totalPasos - 1, i));
    if (destino >= PASOS.length && !planIdCompletar) return;
    setPaso(destino);
    setAvisoPaso(null);
    arriba.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Desde la revisión: al paso del combo o al paso de completar donde se corrige la sección. */
  function irASeccionDelPlan(seccion: string) {
    const pasoCombo = PASO_COMBO_DE_SECCION[seccion];
    if (pasoCombo) {
      irAPaso(PASOS.findIndex((p) => p.id === pasoCombo));
      return;
    }
    const grupo = grupoDeSeccion(gruposPlan, seccion);
    if (grupo && planIdCompletar) irAPaso(PASOS.length + gruposPlan.findIndex((g) => g.id === grupo));
    else if (planIdCompletar) navigate(`/sis2000/plans/${encodeURIComponent(planIdCompletar)}/configurar?seccion=${encodeURIComponent(seccion)}`);
  }

  function siguiente() {
    if (faltasDe(paso).length) {
      setAvisoPaso(paso);
      if (paso === PASOS.findIndex((p) => p.id === 'datos') || paso === PASOS.findIndex((p) => p.id === 'precios')) {
        setIntentoCrear(true);
      }
      return;
    }
    irAPaso(paso + 1);
  }

  function limpiarResultado() {
    setErrorCrear(null);
    if (planGuardado && !planGuardado.editado) setProveedoresKey((k) => k + 1);
    setPlanGuardado(null);
    setCotizacion(null);
    setErrorCotizar(null);
  }

  /** Pide confirmación antes de escribir en Sis2000 (si falta algo, lleva al paso donde se corrige). */
  function pedirConfirmacion() {
    setIntentoCrear(true);
    if (faltas.length) {
      const primero = PASOS.findIndex((p) => p.id === faltas[0].paso);
      if (primero >= 0 && primero !== paso) irAPaso(primero);
      setAvisoPaso(primero >= 0 ? primero : paso);
      return;
    }
    setConfirmando(true);
  }

  // Al editar: lo cambiado en los pasos de completar no está en este formulario; guardarlo otra vez lo pisaría.
  const guardarPisaria = modoEdicion && completar.cambiosPaneles > 0;

  async function guardarPlan() {
    if (guardarPisaria) {
      setConfirmando(false);
      return;
    }
    setIntentoCrear(true);
    limpiarResultado();
    if (errores.length) {
      setConfirmando(false);
      return;
    }
    setCreando(true);
    try {
      const payload = armarPayload();
      const cuerpo = { ...payload, motivoCambio: motivo.trim() || undefined };
      if (modoEdicion && editId) await api.updateSis2000MasterPlan(editId, cuerpo);
      else await api.createSis2000MasterPlan(cuerpo);
      const ifrecuencia =
        opcionesFrecuencia.find((f) => frecuencias.includes(f.ifrecuencia))?.ifrecuencia ?? 'A';
      setPlanGuardado({
        cramo,
        cplan: String(payload.cplan),
        tipo: tipoPlan,
        automovil: automovil && tipoPlan === 'cosas',
        ifrecuencia,
        editado: modoEdicion,
        cotizarPersona:
          tipoPlan === 'personas' && cparens?.length ? { cparen: cparens[0], nedad: entero(edadMin) ?? 0 } : undefined,
      });
      setMotivo('');
      setVersionHistorial((n) => n + 1);
      if (modoEdicion) {
        completar.recargar();
        // Lo recién agregado ya es parte del plan (no se puede quitar desde aquí).
        setPlanOriginal((prev) =>
          prev ? { ...prev, plan: { ...prev.plan, ...payload }, coberturas: incluidas.map((v) => v.cobertura.ccobertura) } : prev,
        );
      } else {
        // Creado: el borrador ya no hace falta (si se recarga, no debe proponer el mismo plan otra vez).
        sinBorrador.current = true;
        borrarBorrador();
      }
    } catch (e) {
      const err = entenderError(e, { que: 'un plan' });
      // Lo llenado no se toca: el usuario corrige y vuelve a guardar.
      setErrorCrear(
        err.tipo === 'duplicado'
          ? { ...err, mensaje: `Ya existe un plan con el código ${cplan.trim()} en este ramo. Vuelve a «Datos del plan» y usa otro código.` }
          : err,
      );
    } finally {
      setCreando(false);
      setConfirmando(false);
    }
  }

  /**
   * Cotiza el plan guardado (solo lectura: no emite): spCalculoRiesgoGeneral en cosas, spCalculoPer en personas (primer
   * parentesco y edad mínima). La tasa la lee nest-api de mamonedas.
   */
  async function cotizar() {
    if (!planGuardado) return;
    setCotizando(true);
    setErrorCotizar(null);
    setCotizacion(null);
    try {
      const rows = await api.cotizarSis2000Plan(
        planGuardado.cramo,
        planGuardado.cplan,
        planGuardado.ifrecuencia,
        planGuardado.cotizarPersona,
      );
      if (!rows.length) {
        setErrorCotizar(
          'La cotización no devolvió coberturas: revisa que el plan tenga suma asegurada y tasa o prima.',
        );
        return;
      }
      setCotizacion(rows);
    } catch (e) {
      setErrorCotizar(entenderError(e));
    } finally {
      setCotizando(false);
    }
  }

  const totalCotizacion = (campo: string) =>
    (cotizacion ?? []).reduce((s, r) => s + (Number(r[campo]) || 0), 0);

  function elegirRamo(valor: string) {
    setRamoFiltro(valor);
    elegirProducto('');
    cerrarNuevoProducto();
    setAvisoProducto(null);
  }

  function cerrarNuevoProducto() {
    setMostrarNuevoProducto(false);
    setNuevoProducto(PRODUCTO_NUEVO);
    setIntentoProducto(false);
    setErrorNuevoProducto(null);
  }

  const ramoElegido = ramoFiltro === RAMO_TODOS ? 0 : Number(ramoFiltro) || 0;
  const erroresProducto = {
    cproducto: !nuevoProducto.cproducto.trim()
      ? 'Escribe el código.'
      : /\s/.test(nuevoProducto.cproducto.trim())
        ? 'El código no puede tener espacios.'
        : undefined,
    xdescripcion_l: !nuevoProducto.xdescripcion_l.trim() ? 'Escribe el nombre.' : undefined,
  };

  function pedirConfirmacionProducto() {
    setIntentoProducto(true);
    setErrorNuevoProducto(null);
    if (!ramoElegido || erroresProducto.cproducto || erroresProducto.xdescripcion_l) return;
    setConfirmandoProducto(true);
  }

  /** Crea el producto en el ramo elegido (sp_CrearProducto), recarga el catálogo y lo deja elegido. */
  async function crearProductoEnRamo() {
    setAvisoProducto(null);
    setGuardandoProducto(true);
    try {
      const r = await api.crearSis2000Producto({
        cproducto: nuevoProducto.cproducto.trim(),
        cramo: ramoElegido,
        xdescripcion_l: nuevoProducto.xdescripcion_l.trim(),
        xdescripcion_c: nuevoProducto.xdescripcion_c.trim() || undefined,
        xabreviatura: nuevoProducto.xabreviatura.trim() || undefined,
        iproductor: nuevoProducto.iproductor,
        icanal: nuevoProducto.icanal,
      });
      const codigo = texto(r.cproducto) || nuevoProducto.cproducto.trim();
      const mensaje = texto(r.message) || 'Producto creado.';
      const datosNuevo = { ...nuevoProducto };
      cerrarNuevoProducto();
      // El catálogo puede tardar en mostrar el producto: se reintenta unas veces y, si no aparece, se deja elegido igual
      // con los datos recién escritos (el plan solo necesita cproducto y cramo).
      let lista: Sis2000Product[] | null = null;
      let nuevo: ReturnType<typeof agruparProductosSis2000>[number] | undefined;
      for (let intento = 0; intento < 4 && !nuevo; intento += 1) {
        if (intento > 0) await new Promise((res) => setTimeout(res, 1200 * intento));
        try {
          lista = await api.listSis2000Products();
          nuevo = agruparProductosSis2000(lista).find(
            (o) => o.cramo === ramoElegido && o.cproducto.toUpperCase() === codigo.toUpperCase(),
          );
        } catch {
          // se reintenta
        }
      }
      if (lista) {
        setProductos(lista);
        setErrorProductos(null);
      }
      if (nuevo) {
        elegirProducto(nuevo.clave);
        setAvisoProducto(`${mensaje} «${datosNuevo.xdescripcion_l.trim()}» quedó elegido: sigue con el tipo de plan.`);
      } else {
        const provisional = productoProvisional(codigo, ramoElegido, datosNuevo.xdescripcion_l.trim(), {
          xdescripcion_c: datosNuevo.xdescripcion_c.trim() || null,
          xabreviatura: datosNuevo.xabreviatura.trim(),
          iproductor: datosNuevo.iproductor,
          icanal: datosNuevo.icanal,
        } as Partial<Sis2000Product>);
        setProductos((prev) => [...(lista ?? prev), provisional]);
        elegirProducto(`${codigo}|${ramoElegido}`);
        setAvisoProducto(
          `${mensaje} «${datosNuevo.xdescripcion_l.trim()}» quedó elegido (todavía no aparece en el catálogo de Sis2000, pero ya puedes armar el plan).`,
        );
      }
    } catch (e) {
      setErrorNuevoProducto(entenderError(e, { que: 'un producto' }));
    } finally {
      setGuardandoProducto(false);
      setConfirmandoProducto(false);
    }
  }

  function elegirProducto(valor: string) {
    const cambia = valor !== claveProducto;
    setClaveProducto(valor);
    setIntentoCrear(false);
    setMostrarNuevaCobertura(false);
    setAvisoCobertura(null);
    limpiarResultado();
    if (!cambia) return;
    // Otro producto: no arrastrar nada del anterior (borrador, coberturas marcadas, tablas, proveedores pendientes y
    // cobro por días). Las coberturas se vuelven a proponer desde sus tarifas.
    borradorFilas.current = null;
    setSearch('');
    setFilasPer({});
    setTablaPlan('');
    setEditandoSuma(null);
    setProveedoresKey((k) => k + 1);
    setFilas((prev) => {
      const next: Record<string, FilaCombo> = {};
      Object.keys(prev).forEach((cc) => {
        const carga = tarifas[cc];
        next[cc] = carga?.estado === 'ok' ? filaInicial(cc, carga.tarifas, hoy) : { ...prev[cc], incluir: false };
      });
      return next;
    });
  }

  /**
   * Vuelve a leer las coberturas del ramo sin perder lo ya marcado: solo se piden las tarifas de las
   * coberturas nuevas (las demás siguen en `solicitadas`).
   */
  async function refrescarCoberturas() {
    if (!cramo) return;
    const ramo = cramo;
    const gen = generacion.current;
    api
      .listSis2000CoberturaSumaConfig(ramo)
      .then((rows) => {
        if (gen === generacion.current) setSumaConfig(indexarSumaConfig(rows));
      })
      .catch(() => undefined);
    try {
      const rows = await api.listSis2000CoberturasByRamo(ramo);
      if (gen !== generacion.current) return;
      const coberturas = rows.map(aCoberturaRamo).filter((c) => c.ccobertura);
      setCatalogo({ cramo: ramo, coberturas });
    } catch (e) {
      if (gen !== generacion.current) return;
      setErrorCoberturas(entenderError(e));
    }
  }

  function coberturaCreada(ccobertura: string, config: CoberturaSumaConfig | null, nombre: string) {
    porIncluir.current.add(ccobertura);
    if (config) setSumaConfig((prev) => ({ ...prev, [ccobertura.toUpperCase()]: config }));
    setMostrarNuevaCobertura(false);
    setSearch('');
    setAvisoCobertura(
      `La cobertura «${nombre || ccobertura}» quedó creada en el ramo con su tarifa. Ya aparece en la lista, marcada para este plan.`,
    );
    limpiarResultado();
    void refrescarCoberturas();
  }

  /**
   * Tras guardar desde el panel «Ver / editar»: vuelve a leer solo esa cobertura (o sus tarifas) y actualiza la fila de
   * la lista. Si el usuario no tocó sus montos y no es del plan que se edita, el plan toma la tasa nueva.
   */
  async function refrescarCobertura(ccobertura: string, que: 'cobertura' | 'tarifas') {
    const ramo = cramo;
    const gen = generacion.current;
    try {
      if (que === 'cobertura') {
        const row = await api.getSis2000Cobertura(ramo, ccobertura);
        if (gen !== generacion.current) return;
        const nueva = aCoberturaRamo(row);
        setCatalogo((prev) =>
          prev && prev.cramo === ramo
            ? { ...prev, coberturas: prev.coberturas.map((c) => (c.ccobertura === ccobertura ? nueva : c)) }
            : prev,
        );
        return;
      }
      const rows = await api.listSis2000Tarifas(ramo, ccobertura);
      if (gen !== generacion.current) return;
      setTarifas((prev) => ({ ...prev, [ccobertura]: { estado: 'ok', tarifas: rows } }));
      if (cobTocadas.has(ccobertura) || delPlan.has(ccobertura)) return;
      setFilas((prev) => {
        const actual = prev[ccobertura];
        if (!actual) return prev;
        const vigentes = rows.filter(esVigente);
        const tarifa = vigentes.find((t) => texto(t.ctarifa) === actual.ctarifa) ?? vigentes[0];
        return { ...prev, [ccobertura]: { ...actual, incluir: actual.incluir && Boolean(tarifa), ...valoresDeTarifa(tarifa, hoy) } };
      });
    } catch (e) {
      if (gen !== generacion.current) return;
      if (que === 'tarifas') {
        setTarifas((prev) => ({ ...prev, [ccobertura]: { estado: 'error', error: mensajeDeError(e) } }));
      }
    }
  }

  function cerrarNuevaCobertura() {
    setMostrarNuevaCobertura(false);
    // Si la cobertura quedó grabada sin tarifa, que se vea en la lista («sin tarifa vigente»).
    void refrescarCoberturas();
  }

  function abrirEditorSuma(v: VistaCobertura) {
    const c = v.sumaConfig;
    setFormSuma({
      tipoSuma: c?.tipoSuma ?? 'FIJA',
      unidadCalculo: texto(c?.unidadCalculo),
      etiquetaCuadro: texto(c?.etiquetaCuadro),
    });
    setIntentoSuma(false);
    setErrorSuma(null);
    setEditandoSuma(v.cobertura.ccobertura);
  }

  const erroresSuma = validarSumaConfig(formSuma);

  async function guardarSuma() {
    if (!editandoSuma) return;
    setIntentoSuma(true);
    if (Object.keys(erroresSuma).length) return;
    setGuardandoSuma(true);
    setErrorSuma(null);
    try {
      const guardada = await api.upsertSis2000CoberturaSumaConfig(cramo, editandoSuma, {
        tipoSuma: formSuma.tipoSuma,
        unidadCalculo: formSuma.unidadCalculo.trim() || undefined,
        etiquetaCuadro: formSuma.etiquetaCuadro.trim() || undefined,
      });
      setSumaConfig((prev) => ({ ...prev, [editandoSuma.toUpperCase()]: guardada }));
      setEditandoSuma(null);
      limpiarResultado();
    } catch (e) {
      setErrorSuma(entenderError(e));
    } finally {
      setGuardandoSuma(false);
    }
  }

  function recargar() {
    void cargarProductos();
    setRecarga((n) => n + 1);
  }

  const ocupado = cargandoProductos || cargandoCoberturas;
  const nombreParen = (c: number) => nombreParentesco(parentescosCat.find((p) => p.cparen === c), c);
  const textoParentescos = cparens ? cparens.map(nombreParen).join(', ') : '—';
  const textoSexo = SEXOS.find((s) => s.valor === csexo)?.etiqueta ?? csexo;
  const textoFrecuencias =
    opcionesFrecuencia.filter((f) => frecuencias.includes(f.ifrecuencia)).map((f) => f.xfrecuencia).join(', ') || '—';
  const textoProductores = productoresSel.todos
    ? 'todos los productores'
    : productoresSel.productores
        .map((p) => (p.xproductor ? `${p.xproductor} (${p.cproductor})` : `productor ${p.cproductor}`))
        .join(', ') || '—';
  const textoCanales = !canalesHabilitados
    ? ''
    : canalesSel.todos
      ? 'todos los canales'
      : canalesSel.canales.map((c) => c.xcanalalt || `canal ${c.ccanalalt}`).join(', ');

  /** Mensajes del plan de personas que no bloquean pero conviene revisar antes de guardar. */
  const avisosPersonas: string[] = [];
  if (personas) {
    tablasDelCombo.forEach((c) => {
      const t = tablasLeidas[c];
      if (t === 'error') avisosPersonas.push(`No se encontró la tabla ${c} en Sis2000: elígela con «Elegir» o créala.`);
      else if (t && t !== 'cargando' && !(t.tramos ?? []).length) avisosPersonas.push(`La tabla ${nombreTabla(c)} no tiene tramos de edad: el plan no podrá cotizar.`);
      else if (t && t !== 'cargando') {
        const min = entero(edadMin);
        const max = entero(edadMax);
        const cubre = (e: number) => (t.tramos ?? []).some((x) => e >= x.nedad_min && e <= x.nedad_max);
        if (min != null && max != null && (!cubre(min) || !cubre(max))) {
          avisosPersonas.push(`La tabla ${nombreTabla(c)} no cubre todas las edades del plan (${min} a ${max} años): a quien quede fuera no se le podrá calcular la prima.`);
        }
      }
    });
  }
  /** Avisos de cosas que no bloquean: coberturas del plan que tenían tasa y prima a la vez. */
  const avisosCosas = !personas && planOriginal
    ? incluidas
        .filter((v) => {
          const f = planOriginal.plan.coberturas;
          const orig = Array.isArray(f)
            ? (f as Record<string, unknown>[]).find((c) => texto(c.ccobertura) === v.cobertura.ccobertura)
            : undefined;
          return orig && Number(orig.pprima ?? 0) > 0 && Number(orig.mprima ?? 0) > 0;
        })
        .map((v) => `«${nombreCob(v)}» tenía tasa y prima fija a la vez; se guardará solo ${v.fila.modo === 'tasa' ? 'la tasa' : 'la prima fija'}.`)
    : [];

  /** Cambios frente al plan leído (modo edición), en palabras. */
  const cambios: string[] = [];
  if (planOriginal) {
    const p = planOriginal.plan;
    const comparar = (etiqueta: string, antes: string, ahora: string) => {
      if (antes !== ahora) cambios.push(`${etiqueta}: «${antes || '—'}» → «${ahora || '—'}»`);
    };
    comparar('Nombre del plan', texto(p.xplan), xplan.trim());
    comparar('Vigencia desde', fechaCorta(texto(p.fdesde)), fechaCorta(fdesde));
    comparar('Vigencia hasta', fechaCorta(texto(p.fhasta)), fechaCorta(fhasta));
    comparar('Moneda', texto(p.cmoneda), cmoneda.trim());
    comparar('Observaciones', texto(p.xobservacion), observacion.trim());
    const frecAntes = (Array.isArray(p.frecuencias) ? (p.frecuencias as Record<string, unknown>[]) : [])
      .map((f) => texto(f.ifrecuencia))
      .sort()
      .join(',');
    if (frecAntes !== [...frecuencias].sort().join(',')) cambios.push(`Formas de pago: ahora ${textoFrecuencias}`);
    // Productores: números ([80080]) al leer de Sis2000; objetos ({ cproductor }) después de guardar.
    const codigoProductor = (x: unknown) =>
      Number(typeof x === 'object' && x !== null ? (x as Record<string, unknown>).cproductor : x);
    const prodAntes =
      p.all_productor === true
        ? 'todos'
        : (Array.isArray(p.productores) ? (p.productores as unknown[]) : []).map(codigoProductor).sort().join(',');
    const prodAhora = productoresSel.todos ? 'todos' : productoresSel.productores.map((x) => x.cproductor).sort().join(',');
    if (prodAntes !== prodAhora) cambios.push(`Quién lo ofrece: ahora ${textoProductores}`);
    const originales = Array.isArray(p.coberturas) ? (p.coberturas as Record<string, unknown>[]) : [];
    for (const v of incluidas) {
      const orig = originales.find((c) => texto(c.ccobertura) === v.cobertura.ccobertura);
      if (!orig) {
        cambios.push(`Se agrega la cobertura «${nombreCob(v)}»`);
        continue;
      }
      if (texto(orig.ctarifa) !== v.fila.ctarifa) cambios.push(`«${nombreCob(v)}»: cambia la opción de tarifa`);
      if (personas) {
        const p0 = (Array.isArray(orig.parentescos) ? (orig.parentescos as Record<string, unknown>[]) : [])[0] ?? {};
        if (Number(p0.msumamax ?? 0) !== numero(v.fila.msumamax)) cambios.push(`«${nombreCob(v)}»: suma asegurada ${formatoMonto2(Number(p0.msumamax ?? 0))} → ${formatoMonto2(numero(v.fila.msumamax))}`);
        if (Number(p0.mprima ?? 0) !== numero(v.fila.mprima)) cambios.push(`«${nombreCob(v)}»: prima por persona ${formatoMonto2(Number(p0.mprima ?? 0))} → ${formatoMonto2(numero(v.fila.mprima))}`);
        if (texto(p0.ctablatar).toUpperCase() !== tablaDe(v.cobertura.ccobertura).toUpperCase()) cambios.push(`«${nombreCob(v)}»: cambia la tabla de precios por edad`);
        if ((orig.bobligatoria !== false) !== filaPer(v.cobertura.ccobertura).obligatoria) cambios.push(`«${nombreCob(v)}»: ahora es ${filaPer(v.cobertura.ccobertura).obligatoria ? 'obligatoria' : 'opcional'}`);
      } else if (!v.calculada) {
        const montos: Array<[string, number, number]> = [
          ['suma mínima', Number(orig.msumamin ?? 0), numero(v.fila.msumamin)],
          ['suma máxima', Number(orig.msumamax ?? 0), numero(v.fila.msumamax)],
          ['tasa %', Number(orig.pprima ?? 0), v.fila.modo === 'tasa' ? numero(v.fila.pprima) : 0],
          ['prima fija', Number(orig.mprima ?? 0), v.fila.modo === 'prima' ? numero(v.fila.mprima) : 0],
        ];
        montos.forEach(([etq, antes, ahora]) => {
          if (antes !== ahora) cambios.push(`«${nombreCob(v)}»: ${etq} ${etq === 'tasa %' ? fmtTasa(antes) : formatoMonto2(antes)} → ${etq === 'tasa %' ? fmtTasa(ahora) : formatoMonto2(ahora)}`);
        });
      }
    }
    if (personas) {
      const p0 = ((originales[0]?.parentescos as Record<string, unknown>[] | undefined) ?? [])[0];
      if (p0) {
        if (Number(p0.nedad_min) !== entero(edadMin) || Number(p0.nedad_max) !== entero(edadMax)) cambios.push(`Edades: ahora de ${edadMin} a ${edadMax} años`);
        if ((texto(p0.csexo) || 'A') !== csexo) cambios.push(`Sexo: ahora ${textoSexo}`);
      }
    }
  }

  /** Coberturas del plan en palabras (para la revisión y la confirmación). */
  function descripcionPrecio(v: VistaIncluida): string {
    if (personas) {
      const tabla = tablaDe(v.cobertura.ccobertura);
      const suma = numero(v.fila.msumamax);
      return `${suma > 0 ? `suma asegurada ${cmoneda} ${formatoMonto2(suma)}; ` : ''}prima según la edad (tabla ${tabla ? nombreTabla(tabla) : 'sin elegir'})`;
    }
    if (v.calculada) return `suma asegurada: ${textoSumaCalculada(v.sumaConfig).toLowerCase()}`;
    const min = numero(v.fila.msumamin);
    const max = numero(v.fila.msumamax);
    const suma = min === max ? `suma asegurada ${cmoneda} ${formatoMonto2(max)}` : `suma asegurada de ${cmoneda} ${formatoMonto2(min)} a ${formatoMonto2(max)}`;
    const precio =
      v.fila.modo === 'tasa'
        ? `tasa ${fmtTasa(numero(v.fila.pprima))} % (con la suma máxima: ${cmoneda} ${formatoMonto2(primaReferencia(v))})`
        : `prima fija ${cmoneda} ${formatoMonto2(numero(v.fila.mprima))}`;
    return `${suma}; ${precio}`;
  }

  const tituloPlan = xplan.trim() || 'sin nombre';
  const accion = modoEdicion ? 'guardar los cambios del' : 'crear el';

  // ──────────────────────────────── Render ────────────────────────────────

  const encabezado = (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <Link
          to={modoEdicion ? '/sis2000/plans' : '/sis2000'}
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {modoEdicion ? 'Planes de Sis2000' : 'Catálogo de Sis2000'}
        </Link>
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <Boxes className="h-5 w-5 text-primary" />
          {modoEdicion ? `Editar plan «${texto(planOriginal?.plan.xplan) || cplan || editId}»` : 'Combos de coberturas'}
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {modoEdicion
            ? 'Cambia los datos del plan, sus montos o agrégale coberturas. Antes de guardar verás qué cambia y lo anterior queda en el historial.'
            : 'Arma un plan nuevo en Sis2000 juntando las coberturas de un ramo, con su suma asegurada y su precio. Te guiamos paso a paso y nada se guarda hasta que lo confirmes al final.'}
        </p>
        {!modoEdicion && (
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Después de guardar el plan sigues en esta misma pantalla con lo que le falta según el ramo: deducibles, pagos,
            quién lo vende, comisiones y, en automóvil, tipo y uso del vehículo y tasa por antigüedad; al final, la revisión
            «¿se puede emitir?». La ficha del plan sigue disponible como alternativa.
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {modoEdicion && editId && (
          <Link
            to={`/sis2000/plans/${encodeURIComponent(editId)}/configurar`}
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
            title="Abre la ficha del plan: deducibles, frecuencias, quién lo ofrece, comisiones, tipo y uso, tasas por antigüedad y la revisión «¿se puede emitir?»"
          >
            Ficha del plan
          </Link>
        )}
        {!modoEdicion && ultimoGuardado && (
          <span
            className="text-[11px] text-muted-foreground"
            title="Lo llenado se guarda en este navegador y se recupera si recargas la página o falla la creación."
          >
            Borrador guardado {ultimoGuardado}
          </span>
        )}
        {modoEdicion && editId && (
          <Link
            to={`/sis2000/plans/${encodeURIComponent(editId)}/json`}
            className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            title="Editor del plan en JSON, para casos que el formulario no cubre"
          >
            Modo avanzado (JSON)
          </Link>
        )}
        {!modoEdicion && (
          <Button type="button" variant="ghost" size="sm" onClick={() => empezarDeCero()}>
            Empezar de cero
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={recargar} disabled={ocupado}>
          <RefreshCw className={cn('h-3.5 w-3.5', ocupado && 'animate-spin')} />
          Recargar
        </Button>
      </div>
    </div>
  );

  // ── Paso 1: Producto ──
  const pasoProducto = (
    <>
      <ComoSeUsa id="combo-producto">
        <p>
          Todo plan pertenece a un <strong>producto</strong> de Sis2000, y cada producto vive en un <strong>ramo</strong>{' '}
          (Automóvil, Responsabilidad Civil, Vida, Salud…). Del ramo salen las coberturas y tarifas que vas a poder usar, y
          lo comparten todos sus productos y planes.
        </p>
        <ol className="list-decimal space-y-0.5 pl-5">
          <li>Elige el ramo para acortar la lista de productos.</li>
          <li>
            Elige el producto. Si no existe todavía, créalo con «Crear producto en este ramo» (código de 6 caracteres como
            máximo).
          </li>
          <li>
            Indica qué asegura el plan: <strong>cosas</strong> (hogar, ganado, responsabilidad civil),{' '}
            <strong>personas</strong> (vida, salud, funerario, viajero) o <strong>automóvil</strong> (casco y RCV). Cambia
            los datos que se piden y cómo se calcula la prima.
          </li>
        </ol>
        <p className="text-sky-800">Ejemplo: ramo «Responsabilidad Civil», producto «RC General», tipo Cosas.</p>
      </ComoSeUsa>

      {modoEdicion ? (
        <SectionPanel title="Producto del plan" description="En un plan que ya existe, el ramo, el producto y el tipo no se cambian desde aquí: las pólizas emitidas dependen de ellos." icon={Package}>
          {cargandoPlan && <div className="h-24 animate-pulse rounded-xl bg-muted/60" />}
          {errorPlan && (
            <>
              <AlertaError
                titulo="No se pudo leer el plan de Sis2000"
                error={errorPlan}
                onReintentar={() => setRecargaPlan((n) => n + 1)}
                reintentando={cargandoPlan}
              />
              {editId && (
                <p className="mt-2 text-xs">
                  <Link to={`/sis2000/plans/${encodeURIComponent(editId)}/json`} className="font-semibold text-primary underline">
                    Abrir en modo avanzado (JSON)
                  </Link>
                </p>
              )}
            </>
          )}
          {!cargandoPlan && !errorPlan && (
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Ramo</dt>
                <dd className="font-semibold">{nombreRamo || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Producto</dt>
                <dd className="font-semibold">{nombreProducto || 'Buscando el producto…'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Tipo de plan</dt>
                <dd className="font-semibold">{personas ? 'Personas' : 'Cosas (patrimonial)'}</dd>
              </div>
            </dl>
          )}
          {planOriginal?.bloqueo && (
            <Alert variant="warning" className="mt-3">
              {planOriginal.bloqueo}{' '}
              {editId && (
                <Link to={`/sis2000/plans/${encodeURIComponent(editId)}/json`} className="font-semibold underline">
                  Abrir en modo avanzado
                </Link>
              )}
            </Alert>
          )}
          {planOriginal && planOriginal.advertencias.length > 0 && (
            <DetallesTecnicos titulo={`Avisos de la lectura del plan (${planOriginal.advertencias.length})`}>
              <ul className="list-disc space-y-0.5 pl-5">
                {planOriginal.advertencias.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </DetallesTecnicos>
          )}
        </SectionPanel>
      ) : (
        <SectionPanel title="¿De qué producto es el plan?" description="El plan se crea dentro del producto; las coberturas y tarifas salen del ramo de ese producto." icon={Package}>
          <FormGrid>
            <FormField
              label="Ramo"
              htmlFor="combo-ramo"
              hint="Escribe el nombre o el número. Ejemplo: «auto» o «18»."
              tooltip={'Línea de seguro de Sis2000 (Automóvil, Vida, Salud, Responsabilidad Civil…). Aquí solo acorta la lista de productos: el ramo del plan es el del producto que elijas, y de él salen las coberturas. Ejemplo: 18 = Automóvil.\nEn Sis2000: maramos.cramo'}
            >
              <ComboBuscable
                id="combo-ramo"
                ariaLabel="Ramo"
                placeholder="Escribe el ramo…"
                value={ramoFiltro}
                onChange={elegirRamo}
                cargando={cargandoProductos && !opcionesRamo.length}
                opciones={opcionesComboRamo}
              />
            </FormField>
            <FormField
              label="Producto"
              htmlFor="combo-producto"
              error={intentoCrear || tocados.has('combo-producto') ? errorDe('combo-producto') : undefined}
              hint={
                !cargandoProductos && !errorProductos && ramoElegido > 0 && !opcionesProductoFiltradas.length
                  ? 'Este ramo todavía no tiene productos: créalo abajo.'
                  : 'Escribe el nombre o el código del producto.'
              }
              tooltip={'Producto comercial bajo el que se vende el plan; define si lo ofrecen productores o canales. Los que también se ofrecen por Nexus lo indican al lado.\nEn Sis2000: maproductos.cproducto'}
            >
              <ComboBuscable
                id="combo-producto"
                ariaLabel="Producto"
                placeholder="Escribe el producto…"
                value={opcionProducto?.clave ?? claveProducto}
                onChange={elegirProducto}
                cargando={cargandoProductos && !productos.length}
                opciones={opcionesComboProducto}
              />
            </FormField>
          </FormGrid>

          {ramoElegido > 0 && !mostrarNuevoProducto && (
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setAvisoProducto(null);
                  setMostrarNuevoProducto(true);
                }}
                disabled={guardandoProducto}
              >
                <Plus className="h-3.5 w-3.5" />
                Crear producto en este ramo
              </Button>
            </div>
          )}
          {ramoElegido > 0 && mostrarNuevoProducto && (
            <div className="mt-4 rounded-xl border border-border/60 bg-slate-50/60 p-4">
              <p className="mb-1 text-sm font-semibold">Nuevo producto en {nombreRamo || opcionesRamo.find((r) => r.cramo === ramoElegido)?.etiqueta || `el ramo ${ramoElegido}`}</p>
              <p className="mb-3 text-xs text-muted-foreground">Se crea en Sis2000 cuando lo confirmes, en este ramo; después lo puedes usar en este y en otros planes del mismo ramo.</p>
              <FormGrid>
                <FormField
                  label="Nombre del producto *"
                  htmlFor="nuevo-prod-nombre"
                  hint="Como lo verá el asegurado. Ejemplo: RC GENERAL PARTICULAR. Máx. 60 caracteres."
                  tooltip={'Nombre largo del producto; es el que muestran SysIP y la tarjeta del MarketPlace.\nEn Sis2000: maproductos.xdescripcion_l'}
                  error={intentoProducto ? erroresProducto.xdescripcion_l : undefined}
                >
                  <Input
                    id="nuevo-prod-nombre"
                    maxLength={60}
                    value={nuevoProducto.xdescripcion_l}
                    onChange={(e) => setNuevoProducto((p) => ({ ...p, xdescripcion_l: e.target.value }))}
                  />
                </FormField>
                <FormField
                  label="Código del producto *"
                  htmlFor="nuevo-prod-codigo"
                  hint="Identificador corto, sin espacios (máx. 6). Ejemplo: RCG01."
                  tooltip={'Clave con la que Sis2000 y la emisión identifican el producto; los planes la guardan y no se cambia después. Máximo 6 caracteres, porque el alta de planes no acepta más. Pídela a Técnica si hay una convención. Ejemplo: RCG01.\nEn Sis2000: maproductos.cproducto'}
                  error={intentoProducto ? erroresProducto.cproducto : undefined}
                >
                  <Input
                    id="nuevo-prod-codigo"
                    maxLength={6}
                    value={nuevoProducto.cproducto}
                    onChange={(e) =>
                      setNuevoProducto((p) => ({ ...p, cproducto: e.target.value.replace(/\s/g, '').toUpperCase() }))
                    }
                  />
                </FormField>
                <FormField
                  label="Nombre corto"
                  htmlFor="nuevo-prod-corto"
                  hint="Opcional, para reportes (máx. 15). Vacío = inicio del nombre."
                >
                  <Input
                    id="nuevo-prod-corto"
                    maxLength={15}
                    value={nuevoProducto.xdescripcion_c}
                    onChange={(e) => setNuevoProducto((p) => ({ ...p, xdescripcion_c: e.target.value }))}
                  />
                </FormField>
                <FormField label="Abreviatura" htmlFor="nuevo-prod-abrev" hint="Opcional (máx. 5). Ejemplo: RCG.">
                  <Input
                    id="nuevo-prod-abrev"
                    maxLength={5}
                    value={nuevoProducto.xabreviatura}
                    onChange={(e) => setNuevoProducto((p) => ({ ...p, xabreviatura: e.target.value }))}
                  />
                </FormField>
              </FormGrid>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className={ETIQUETA_OPCION}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={nuevoProducto.iproductor}
                    onChange={(e) => setNuevoProducto((p) => ({ ...p, iproductor: e.target.checked }))}
                  />
                  Lo ofrecen productores
                </label>
                <label className={ETIQUETA_OPCION}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={nuevoProducto.icanal}
                    onChange={(e) => setNuevoProducto((p) => ({ ...p, icanal: e.target.checked }))}
                  />
                  Lo ofrecen canales
                </label>
              </div>
              <AlertaError
                className="mt-3"
                titulo="No se pudo crear el producto"
                error={errorNuevoProducto}
                onReintentar={() => void crearProductoEnRamo()}
                reintentando={guardandoProducto}
                idDeCampo={(prop) =>
                  ({ cproducto: 'nuevo-prod-codigo', xdescripcion_l: 'nuevo-prod-nombre', xdescripcion_c: 'nuevo-prod-corto', xabreviatura: 'nuevo-prod-abrev' })[prop]
                }
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" onClick={pedirConfirmacionProducto} disabled={guardandoProducto}>
                  {guardandoProducto ? 'Creando…' : 'Crear producto'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={cerrarNuevoProducto} disabled={guardandoProducto}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
          {avisoProducto && (
            <Alert variant="success" className="mt-3">
              {avisoProducto}
            </Alert>
          )}
          <AlertaError
            className="mt-3"
            titulo="No se pudo leer la lista de productos de Sis2000"
            error={errorProductos}
            onReintentar={() => void cargarProductos()}
            reintentando={cargandoProductos}
          />

          <div className="mt-5 border-t border-border/50 pt-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              ¿Qué asegura el plan?
              <InfoTip text={'Define cómo se calcula la prima. Cosas: suma asegurada con tasa % o prima fija por cobertura. Personas: quiénes se aseguran (parentescos), edades de entrada y una tabla de precios por edad. Automóvil se graba como cosas y luego, en la ficha del plan, sigue con tipo y uso y tasa por antigüedad.\nEn Sis2000: maplanes (cosas y auto) · maplanes_per (personas)'} />
            </p>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Tipo de plan">
              {(
                [
                  {
                    valor: 'cosas',
                    titulo: 'Cosas (patrimonial)',
                    texto: 'Vehículos, hogar, ganado, responsabilidad civil… Suma asegurada con tasa % o prima fija.',
                  },
                  {
                    valor: 'personas',
                    titulo: 'Personas',
                    texto: 'Vida, salud, funerario, viajero… Quiénes se aseguran, sus edades y el precio según la edad.',
                  },
                  {
                    valor: 'automovil',
                    titulo: 'Automóvil',
                    texto: 'Vehículos (casco y RCV): coberturas con tasa o prima, prima base por tipo y uso, y tasa de casco por antigüedad.',
                  },
                ] as const
              ).map((o) => {
                const elegido = o.valor === 'automovil' ? automovil : !automovil && tipoPlan === o.valor;
                const sugerido = !elegido && ((o.valor === 'personas' && esPersonas) || (o.valor === 'automovil' && esAuto));
                return (
                  <button
                    key={o.valor}
                    type="button"
                    role="radio"
                    aria-checked={elegido}
                    onClick={() => cambiarTipoPlan(o.valor)}
                    className={cn(
                      'rounded-xl border p-3 text-left text-xs transition-colors',
                      elegido ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300' : 'border-border/60 bg-card hover:bg-muted/40',
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {o.titulo}
                      {sugerido && (
                        <Badge variant="submitted" className="px-2 py-0 text-[10px]">
                          Sugerido
                        </Badge>
                      )}
                    </span>
                    <span className="mt-1 block text-muted-foreground">{o.texto}</span>
                  </button>
                );
              })}
            </div>
            {automovil && cramo > 0 && familiaRamo !== null && !esAuto && (
              <Alert variant="warning" className="mt-3">
                El ramo {nombreRamo || cramo} no es de vehículos: la ficha del plan no tendrá tarifa por tipo y uso ni tasa por
                antigüedad. Si el plan no asegura vehículos, elige «Cosas» o «Personas».
              </Alert>
            )}
            {esPersonas && !personas && (
              <Alert variant="warning" className="mt-3">
                Este producto es de personas y elegiste «{automovil ? 'Automóvil' : 'Cosas'}». Si el plan asegura personas
                (con edades y parentescos), cambia a Personas.
                <div className="mt-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => cambiarTipoPlan('personas')}>
                    Cambiar a Personas
                  </Button>
                </div>
              </Alert>
            )}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            ¿Quieres cambiar un plan que ya existe?{' '}
            <Link to="/sis2000/plans" className="font-semibold text-primary underline-offset-2 hover:underline">
              Búscalo en Planes de Sis2000
            </Link>{' '}
            y pulsa «Editar».
          </p>
          <DetallesTecnicos>
            <p>
              Producto: <code>{cproducto || '—'}</code> · ramo <code>{cramo || '—'}</code>
              {opcionProducto && opcionProducto.formularios.length > 0 && <> · formularios {opcionProducto.formularios.join(', ')}</>}
            </p>
            <p>
              Alta de producto: nest-api <code>POST /api/v1/configurador/productos</code> → sp_CrearProducto (maproductos).
            </p>
          </DetallesTecnicos>
        </SectionPanel>
      )}
    </>
  );

  // Panel lateral «Ver / editar» de una cobertura (usa lo ya leído: no repite llamadas).
  const fichaVista = fichaCob ? vistas.find((v) => v.cobertura.ccobertura === fichaCob) : undefined;
  const fichaCobertura = fichaVista?.cobertura ?? (fichaCob ? catalogo?.coberturas.find((c) => c.ccobertura === fichaCob) : undefined);
  const fichaCarga = fichaCob ? tarifas[fichaCob] : undefined;
  const fichaPanel =
    fichaCob && fichaCobertura && cramo ? (
      <CoberturaFichaPanel
        key={fichaCob}
        cramo={cramo}
        cobertura={fichaCobertura.fila}
        tarifas={fichaCarga?.estado === 'ok' ? fichaCarga.tarifas : null}
        cargandoTarifas={!fichaCarga || fichaCarga.estado === 'cargando'}
        errorTarifas={fichaCarga?.estado === 'error' ? fichaCarga.error : undefined}
        calculada={Boolean(fichaVista?.calculada)}
        textoCalculada={fichaVista?.calculada ? textoSumaCalculada(fichaVista.sumaConfig) : undefined}
        personas={personas}
        enPlan={
          fichaVista?.fila
            ? {
                incluida: Boolean(fichaVista.fila.incluir && fichaVista.tarifa) || delPlan.has(fichaCob),
                delPlan: delPlan.has(fichaCob),
                ctarifa: fichaVista.fila.ctarifa,
                msumamin: fichaVista.fila.msumamin,
                msumamax: fichaVista.fila.msumamax,
                pprima: fichaVista.fila.pprima,
                mprima: fichaVista.fila.mprima,
                modo: fichaVista.fila.modo,
                obligatoria: personas ? filaPer(fichaCob).obligatoria : fichaVista.obligatoria,
                ctablatar: filaPer(fichaCob).ctablatar,
              }
            : null
        }
        soloLectura={ramoSoloLectura}
        onCerrar={() => setFichaCob(null)}
        onCambio={(que) => void refrescarCobertura(fichaCob, que)}
      />
    ) : null;

  // ── Paso 2: Coberturas ──
  const pasoCoberturas = (
    <>
      <ComoSeUsa id="combo-coberturas">
        <p>
          Marca las coberturas que va a tener el plan. Las <strong>obligatorias</strong> entran marcadas solas; las{' '}
          <strong>opcionales</strong> el asegurado las puede tomar o no. Obligatoria u opcional viene de la tarifa del
          ramo, no del plan.
        </p>
        <ul className="list-disc space-y-0.5 pl-5">
          <li>Si falta una cobertura, créala con «Crear cobertura nueva» (queda en el ramo y marcada en este plan).</li>
          <li>
            Una cobertura «sin tarifa vigente» no se puede usar hasta que Técnica le cargue una tarifa: sin ella no se cotiza
            ni se emite.
          </li>
          <li>En el siguiente paso pones la suma asegurada y el precio de cada una.</li>
        </ul>
        {modoEdicion && (
          <p className="font-medium">
            Editando: las coberturas que ya tiene el plan aparecen con candado y no se pueden quitar desde aquí; puedes
            agregar otras.
          </p>
        )}
      </ComoSeUsa>

      {!cramo ? (
        <SectionPanel title="Coberturas del plan" icon={Shield}>
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Primero elige el producto en el paso 1: las coberturas salen de su ramo.
          </p>
        </SectionPanel>
      ) : (
        <SectionPanel
          title={`Coberturas de ${nombreRamo || `el ramo ${cramo}`}`}
          description="Todas las coberturas del ramo; las comparten todos sus productos y planes. Marca solo las de este plan."
          icon={Shield}
        >
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="w-full max-w-sm">
              <Input placeholder="Buscar por nombre…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <label className={ETIQUETA_OPCION}>
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={soloMarcadas}
                onChange={(e) => setSoloMarcadas(e.target.checked)}
              />
              Ver solo las marcadas ({incluidas.length})
            </label>
            <label className={ETIQUETA_OPCION}>
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={mostrarInactivas}
                onChange={(e) => setMostrarInactivas(e.target.checked)}
              />
              Mostrar inactivas{inactivas ? ` (${inactivas})` : ''}
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => {
                setAvisoCobertura(null);
                setMostrarNuevaCobertura((v) => !v);
              }}
              disabled={!catalogo || catalogo.cramo !== cramo}
            >
              <Plus className="h-3.5 w-3.5" />
              Crear cobertura nueva
            </Button>
          </div>

          {avisoCobertura && (
            <Alert variant="success" className="mb-3">
              {avisoCobertura}
            </Alert>
          )}

          {mostrarNuevaCobertura && catalogo && catalogo.cramo === cramo && (
            <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50/30 p-4">
              <p className="mb-1 text-sm font-bold text-slate-800">Nueva cobertura en {nombreRamo || `el ramo ${cramo}`}</p>
              <Sis2000NuevaCoberturaForm
                key={cramo}
                cramo={cramo}
                existentes={catalogo.coberturas.map((c) => c.fila)}
                monedaSugerida={cmoneda || '$'}
                onCreada={(c) => coberturaCreada(c.ccobertura, c.sumaConfig, c.nombre ?? '')}
                onCancelar={cerrarNuevaCobertura}
              />
            </div>
          )}

          {cargandoTarifas && (
            <div className="mb-3 max-w-md" aria-live="polite">
              <p className="mb-1 text-xs text-muted-foreground">
                Leyendo tarifas: {tarifasListas} de {totalTarifas}…
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all"
                  style={{ width: `${totalTarifas ? (tarifasListas / totalTarifas) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          <AlertaError
            titulo="No se pudieron leer las coberturas del ramo"
            error={errorCoberturas}
            onReintentar={recargar}
            reintentando={cargandoCoberturas}
          />
          {cargandoCoberturas && <div className="h-48 animate-pulse rounded-2xl bg-muted/60" />}

          {!cargandoCoberturas && !errorCoberturas && catalogo && vistas.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Este ramo no tiene coberturas{mostrarInactivas ? '' : ' activas'}. Créala con «Crear cobertura nueva».
            </p>
          )}

          {!cargandoCoberturas && !errorCoberturas && vistas.length > 0 && (
            <div id="combo-tabla-coberturas" tabIndex={-1} className="tabla-cabecera-fija rounded-xl border border-border/60">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border/50 bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="w-12 px-3 py-2">
                      <span className="sr-only">Incluir</span>
                    </th>
                    <th className="px-3 py-2">Cobertura</th>
                    <th className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        {personas ? 'Obligatoria en el plan' : 'Tipo'}
                        <InfoTip
                          text={
                            personas
                              ? 'Marca la cobertura como obligatoria u opcional dentro de este plan; queda guardada en el plan, no en la tarifa. Hoy los cálculos de cotización y emisión de Nexus no leen esta marca.\nEn Sis2000: maplcober_per.bobligatoria'
                              : 'Obligatoria u opcional no se decide aquí: viene de la tarifa de la cobertura en el ramo y vale para todos los planes que la usan. Las obligatorias van siempre en la póliza.\nEn Sis2000: matarifa.bobligatoria'
                          }
                        />
                      </span>
                    </th>
                    <th className="w-px whitespace-nowrap px-3 py-2">
                      <span className="sr-only">Ver o editar</span>
                    </th>
                  </tr>
                </thead>
                <ListaAnimada as="tbody">
                  {filtradas.map((v) => {
                    const { cobertura: c, fila } = v;
                    const habilitada = Boolean(fila && v.tarifa);
                    const incluida = Boolean(habilitada && fila?.incluir);
                    const bloqueada = delPlan.has(c.ccobertura);
                    return (
                      <tr
                        key={c.ccobertura}
                        className={cn(
                          'border-b border-border/30',
                          incluida && 'bg-indigo-50/60',
                          !habilitada && !bloqueada && 'text-muted-foreground',
                        )}
                      >
                        <td className="px-3 py-2 align-top">
                          {bloqueada ? (
                            <span title="Ya es parte del plan: para quitarla, dala de baja desde la ficha del plan" className="inline-flex text-indigo-600">
                              <Lock className="h-4 w-4" />
                            </span>
                          ) : (
                            <input
                              id={`cob-${c.ccobertura}`}
                              type="checkbox"
                              className="h-4 w-4 accent-primary"
                              checked={incluida}
                              disabled={!habilitada}
                              onChange={(e) => cambiarFila(c.ccobertura, { incluir: e.target.checked })}
                            />
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <label htmlFor={`cob-${c.ccobertura}`} className={cn('font-medium text-slate-800', habilitada && !bloqueada && 'cursor-pointer')}>
                            {c.descripcion || 'Cobertura sin nombre'}
                          </label>
                          <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
                            {bloqueada && <Badge variant="submitted" className="px-2 py-0 text-[10px]">Ya en el plan</Badge>}
                            {c.inactiva && <Badge variant="draft" className="px-2 py-0 text-[10px]">Inactiva</Badge>}
                            {v.calculada && !personas && (
                              <Badge variant="actuarial" className="px-2 py-0 text-[10px]">Suma calculada al emitir</Badge>
                            )}
                          </span>
                          {(!v.carga || v.carga.estado === 'cargando') && (
                            <span className="block text-[11px] text-muted-foreground">Leyendo su tarifa…</span>
                          )}
                          {v.carga?.estado === 'error' && (
                            <span className="block text-[11px] text-rose-600" title={v.carga.error}>
                              No se pudo leer su tarifa: {v.carga.error}{' '}
                              <button type="button" className="font-semibold underline" onClick={reintentarTarifas}>
                                Reintentar
                              </button>
                            </span>
                          )}
                          {v.carga?.estado === 'ok' && !v.vigentes.length && (
                            <span className="block text-[11px] font-semibold text-amber-700">
                              Sin tarifa vigente: no se puede usar todavía.{' '}
                              <Link
                                to={`/sis2000/ramo/${cramo}/coberturas/${encodeURIComponent(c.ccobertura)}/tarifas`}
                                className="font-medium text-primary underline-offset-2 hover:underline"
                              >
                                Ver sus tarifas
                              </Link>
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {personas ? (
                            incluida ? (
                              <label className="inline-flex cursor-pointer items-center gap-2">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-primary"
                                  checked={filaPer(c.ccobertura).obligatoria}
                                  onChange={(e) => cambiarFilaPer(c.ccobertura, { obligatoria: e.target.checked })}
                                />
                                {filaPer(c.ccobertura).obligatoria ? 'Obligatoria' : 'Opcional'}
                              </label>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )
                          ) : v.obligatoria ? (
                            <Badge variant="submitted">Obligatoria</Badge>
                          ) : (
                            <Badge>Opcional</Badge>
                          )}
                        </td>
                        <td className="w-px whitespace-nowrap px-3 py-2 text-right align-top">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 shrink-0 whitespace-nowrap px-2 text-[11px]"
                            onClick={() => setFichaCob(c.ccobertura)}
                            aria-label={`Ver o editar la cobertura ${c.descripcion || c.ccobertura}`}
                            title="Ver / editar"
                          >
                            <Eye className="h-3.5 w-3.5 shrink-0" />
                            <span className="hidden sm:inline">Ver / editar</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {filtradas.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-xs text-muted-foreground">
                        {soloMarcadas ? 'Todavía no marcaste coberturas.' : 'Ninguna cobertura coincide con la búsqueda.'}
                      </td>
                    </tr>
                  )}
                </ListaAnimada>
              </table>
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {incluidas.length} marcada{incluidas.length === 1 ? '' : 's'} de {vistas.length}
                {sinTarifa ? ` · ${sinTarifa} sin tarifa vigente` : ''}
              </p>
            </div>
          )}
          <DetallesTecnicos>
            <p>Coberturas: nest-api <code>GET /api/v1/configurador/coberturas?cramo={cramo}</code> (macoberturas). Tarifas: <code>GET /api/v1/configurador/tarifas</code> (matarifa, matarifa_d).</p>
            {incluidas.length > 0 && (
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="pr-3">Cobertura</th>
                    <th className="pr-3">ccobertura</th>
                    <th className="pr-3">ctarifa</th>
                    <th>Nombre de tarifa</th>
                  </tr>
                </thead>
                <tbody>
                  {incluidas.map((v) => (
                    <tr key={v.cobertura.ccobertura}>
                      <td className="pr-3">{nombreCob(v)}</td>
                      <td className="pr-3 font-mono">{v.cobertura.ccobertura}</td>
                      <td className="pr-3 font-mono">{v.fila.ctarifa}</td>
                      <td>{formatTarifaDescripcion(v.tarifa)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </DetallesTecnicos>
        </SectionPanel>
      )}
      {fichaPanel}
    </>
  );

  /** Editor de suma FIJA / CALCULADA (cosas), se muestra bajo la cobertura que se edita. */
  const editorSuma = editandoSuma && !personas && (
    <div className="mt-3 space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Suma asegurada: fija o calculada al emitir</p>
      <p className="text-xs text-muted-foreground">
        Se guarda en el configurador y aplica a esta cobertura en cualquier plan del ramo. «Calculada» sirve cuando la
        suma depende de algo que se conoce al emitir (por ejemplo, kilos × precio por kilo).
      </p>
      <AlertaError
        titulo="No se pudo guardar cómo se calcula la suma"
        error={errorSuma}
        onReintentar={() => void guardarSuma()}
        reintentando={guardandoSuma}
      />
      <CoberturaSumaConfigFields
        idPrefix={`suma-${editandoSuma}`}
        valores={formSuma}
        errores={intentoSuma ? erroresSuma : {}}
        disabled={guardandoSuma}
        onChange={(cambiosSuma) => setFormSuma((prev) => ({ ...prev, ...cambiosSuma }))}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" disabled={guardandoSuma} onClick={() => setEditandoSuma(null)}>
          Cancelar
        </Button>
        <Button type="button" disabled={guardandoSuma} onClick={() => void guardarSuma()}>
          {guardandoSuma ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </div>
  );

  /** Selector de opción de tarifa (sin código ni nombre interno). */
  function selectorTarifa(v: VistaCobertura) {
    if (!v.fila) return null;
    const vencida = !v.tarifa && v.vigentes.length > 0;
    if (v.vigentes.length <= 1 && !vencida) return null;
    return (
      <FormField
        label="Opción de tarifa"
        hint={vencida ? 'La tarifa que tenía el plan venció: elige una vigente.' : 'Esta cobertura tiene varias tarifas vigentes.'}
        tooltip={'Cada tarifa vigente de la cobertura trae su propia suma y tasa o prima sugeridas; al cambiarla se vuelven a llenar. El plan queda amarrado a la tarifa que elijas: de ella sale también si la cobertura es obligatoria u opcional.\nEn Sis2000: maplantar.ctarifa · matarifa_d'}
        error={vencida ? 'Elige una tarifa vigente.' : undefined}
      >
        <Select value={vencida ? undefined : v.fila.ctarifa} onValueChange={(valor) => cambiarTarifa(v, valor)}>
          <SelectTrigger id={`p-tarifa-${v.cobertura.ccobertura}`} aria-label={`Opción de tarifa de ${nombreCob(v)}`}>
            <SelectValue placeholder="Elige la tarifa…" />
          </SelectTrigger>
          <SelectContent>
            {v.vigentes.map((t, i) => (
              <SelectItem key={texto(t.ctarifa)} value={texto(t.ctarifa)}>
                {etiquetaTarifa(t, i, hoy, cmoneda)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
    );
  }

  /** Coberturas del plan que se edita con tarifa vencida y alguna vigente para elegir. */
  const conTarifaVencida = delPlanConProblema
    .map((x) => x.vista)
    .filter((v): v is VistaCobertura => Boolean(v && v.fila && v.vigentes.length));

  // ── Paso 3: Tarifas y tasas ──
  const pasoPreciosCosas = (
    <SectionPanel
      title="Suma asegurada y precio de cada cobertura"
      description="Los valores sugeridos vienen de la tarifa vigente de cada cobertura; si los cambias, solo aplican a este plan, no a la tarifa del ramo."
      icon={Calculator}
    >
      {!incluidas.length ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Marca coberturas en el paso 2 para ponerles suma y precio.
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={sumaCerradaEnTodas}
              title="Iguala la suma mínima a la máxima en todas las coberturas: el asegurado no elige suma y la prima no cambia."
            >
              <Equal className="h-3.5 w-3.5" />
              Suma fija (mínima = máxima) en todas
            </Button>
          </div>
          <ListaAnimada className="space-y-3">
            {incluidas.map((v) => {
              const cc = v.cobertura.ccobertura;
              const f = v.fila;
              const marcarError = (cond: boolean) =>
                (intentoCrear || cobTocadas.has(cc)) && cond && 'border-rose-400 ring-1 ring-rose-300';
              return (
                <li key={cc} className="rounded-xl border border-border/60 bg-white p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">{nombreCob(v)}</p>
                    {v.obligatoria ? <Badge variant="submitted" className="px-2 py-0 text-[10px]">Obligatoria</Badge> : <Badge className="px-2 py-0 text-[10px]">Opcional</Badge>}
                    {v.calculada && <Badge variant="actuarial" className="px-2 py-0 text-[10px]">Suma calculada al emitir</Badge>}
                    <button
                      type="button"
                      className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-indigo-700"
                      onClick={() => abrirEditorSuma(v)}
                    >
                      <Pencil className="h-3 w-3" />
                      ¿Suma fija o calculada al emitir?
                    </button>
                  </div>
                  {v.calculada ? (
                    <p className="text-xs text-amber-800">
                      {textoSumaCalculada(v.sumaConfig)}: la suma asegurada (y su precio) se calculan al emitir, con las
                      unidades que indique el asegurado. Aquí no hay que llenar montos.
                    </p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {selectorTarifa(v)}
                      <FormField
                        label="Suma asegurada mínima"
                        hint={`Lo menos que se puede asegurar. Ejemplo: 1000.`}
                        tooltip={'Lo menos que el asegurado puede asegurar en esta cobertura con este plan. Viene sugerida por la tarifa vigente; si la igualas a la máxima, la suma es fija.\nEn Sis2000: maplantar.msumamin'}
                      >
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="any"
                          id={`p-min-${cc}`}
                          data-cob={cc}
                          aria-label={`Suma mínima de ${nombreCob(v)}`}
                          value={f.msumamin}
                          onChange={(e) => cambiarFila(cc, { msumamin: e.target.value })}
                          className={cn(marcarError(numero(f.msumamin) > numero(f.msumamax)))}
                        />
                      </FormField>
                      <FormField
                        label="Suma asegurada máxima *"
                        hint="Lo más que se puede asegurar. Debe ser mayor a 0."
                        tooltip={'Lo más que se puede asegurar en esta cobertura con este plan. Con tasa, la prima se calcula sobre la suma que elija el asegurado; con prima fija, la suma no cambia la prima. Ejemplo: 50.000.\nEn Sis2000: maplantar.msumamax'}
                      >
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="any"
                            id={`p-max-${cc}`}
                            data-cob={cc}
                            aria-label={`Suma máxima de ${nombreCob(v)}`}
                            value={f.msumamax}
                            onChange={(e) => cambiarFila(cc, { msumamax: e.target.value })}
                            className={cn(marcarError(!(numero(f.msumamax) > 0)))}
                          />
                          <button
                            type="button"
                            className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                            title="Suma fija: igualar la mínima a la máxima"
                            aria-label={`Suma fija en ${nombreCob(v)}`}
                            disabled={!f.msumamax || f.msumamin === f.msumamax}
                            onClick={() => igualarSuma(cc)}
                          >
                            <Equal className="h-4 w-4" />
                          </button>
                        </div>
                      </FormField>
                      <div className="flex flex-col gap-1.5">
                        <span className="flex items-center gap-1.5 text-[0.78rem] font-bold tracking-wide text-slate-600">
                          ¿Cómo se cobra? *
                          <InfoTip text={'Tasa y prima son excluyentes: elige una sola. Tasa = % sobre la suma asegurada (0,5 con 50.000 da 250); prima fija = monto igual para cualquier suma. La otra queda en 0.\nEn Sis2000: maplantar.pprima (tasa) · maplantar.mprima (prima fija)'} />
                        </span>
                        <div className="inline-flex rounded-xl border border-border/60 bg-slate-50 p-0.5 text-xs font-semibold" role="radiogroup" aria-label={`Cómo se cobra ${nombreCob(v)}`}>
                          {(['tasa', 'prima'] as const).map((m) => (
                            <button
                              key={m}
                              type="button"
                              role="radio"
                              aria-checked={f.modo === m}
                              onClick={() => cambiarFila(cc, { modo: m })}
                              className={cn(
                                'flex-1 rounded-lg px-3 py-1.5 transition-colors',
                                f.modo === m ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200' : 'text-slate-500 hover:text-slate-700',
                              )}
                            >
                              {m === 'tasa' ? 'Tasa %' : 'Prima fija'}
                            </button>
                          ))}
                        </div>
                        <div className="relative">
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="any"
                            id={`p-valor-${cc}`}
                            data-cob={cc}
                            aria-label={f.modo === 'tasa' ? `Tasa % de ${nombreCob(v)}` : `Prima fija de ${nombreCob(v)}`}
                            value={f.modo === 'tasa' ? f.pprima : f.mprima}
                            onChange={(e) => cambiarFila(cc, f.modo === 'tasa' ? { pprima: e.target.value } : { mprima: e.target.value })}
                            className={cn('pr-10', marcarError(!((f.modo === 'tasa' ? numero(f.pprima) : numero(f.mprima)) > 0)))}
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            {f.modo === 'tasa' ? '%' : cmoneda}
                          </span>
                        </div>
                        <p className="text-[0.72rem] leading-relaxed text-slate-500">
                          {f.modo === 'tasa'
                            ? numero(f.pprima) > 0 && numero(f.msumamax) > 0
                              ? `Con la suma máxima: ${cmoneda} ${formatoMonto2(primaReferencia(v))}.`
                              : 'Ejemplo: 0.5 = 0,5 % de la suma asegurada.'
                            : 'Lo mismo para cualquier suma asegurada.'}
                        </p>
                      </div>
                    </div>
                  )}
                  {(intentoCrear || cobTocadas.has(cc)) && faltasCob(cc).length > 0 && (
                    <ul className="mt-3 space-y-0.5 text-[0.72rem] font-semibold text-rose-600" role="alert">
                      {faltasCob(cc).map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  )}
                  {editandoSuma === cc && editorSuma}
                </li>
              );
            })}
          </ListaAnimada>
          <p className="mt-3 text-right text-sm">
            Prima de referencia del plan (con las sumas máximas):{' '}
            <strong>
              {cmoneda} {formatoMonto(resumen.prima)}
            </strong>
          </p>
          <p className="text-right text-[0.72rem] text-slate-500">
            Solo es una referencia: la prima real la calcula Sis2000 al cotizar o emitir (con la suma elegida y, en auto, el tipo y uso y la
            antigüedad del vehículo).
          </p>
        </>
      )}
    </SectionPanel>
  );

  const pasoPreciosPersonas = (
    <>
      <SectionPanel
        title="¿Quiénes se aseguran?"
        description="Los mismos parentescos y edades aplican a todas las coberturas del plan."
        icon={Users}
      >
        <FormGrid>
          <FormField
            span={2}
            label="Parentescos que puede incluir el plan *"
            htmlFor="combo-cparen-texto"
            hint="Titular es el asegurado principal. Ejemplo: Titular, Cónyuge, Hijos."
            tooltip={'Quiénes pueden entrar en la póliza (Titular, Cónyuge, Hijos…). Cada cobertura se graba una vez por parentesco marcado, con su tabla de precios; un parentesco sin marcar no se puede asegurar con este plan.\nEn Sis2000: mapltarifas_per.cparen · mapledades_per'}
            error={errorDe('combo-cparen-texto')}
          >
            <ParentescosSelector
              idPrefix="combo-cparen"
              value={parentescosTxt}
              onChange={setParentescosTxt}
              onCatalogo={setParentescosCat}
            />
          </FormField>
          <FormField
            label="Sexo"
            htmlFor="combo-csexo"
            hint="Normalmente «Ambos»."
            tooltip={'Se guarda como dato del plan, pero hoy ningún cálculo de cotización ni de emisión lo aplica: no limita quién puede asegurarse.\nEn Sis2000: mapltarifas_per.csexo'}
          >
            <Select value={csexo} onValueChange={setCsexo}>
              <SelectTrigger id="combo-csexo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEXOS.map((s) => (
                  <SelectItem key={s.valor} value={s.valor}>
                    {s.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Edad mínima *"
              htmlFor="combo-edad-min"
              hint="En años. Ejemplo: 0."
              tooltip={'Edad mínima de entrada para cada parentesco marcado. La valida la cotización; la tabla de precios debe cubrir desde esta edad o esa persona queda con prima 0.\nEn Sis2000: mapledades_per.cemin_ase · mapltarifas_per.nedad_min'}
              error={errorDe('combo-edad-min')}
            >
              <Input
                id="combo-edad-min"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={edadMin}
                onChange={(e) => setEdadMin(e.target.value)}
              />
            </FormField>
            <FormField
              label="Edad máxima *"
              htmlFor="combo-edad-max"
              hint="En años. Ejemplo: 74."
              tooltip={'Edad máxima de entrada para cada parentesco marcado. La valida la cotización; la tabla de precios debe llegar hasta esta edad o esa persona queda con prima 0.\nEn Sis2000: mapledades_per.cemax_ase · mapltarifas_per.nedad_max'}
              error={errorDe('combo-edad-max')}
            >
              <Input
                id="combo-edad-max"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={edadMax}
                onChange={(e) => setEdadMax(e.target.value)}
              />
            </FormField>
          </div>
        </FormGrid>
      </SectionPanel>

      <SectionPanel
        title="Precio según la edad"
        description="Cada cobertura usa una tabla de precios por edad (tramos de edad con su prima o tasa); la suma asegurada se indica por cobertura."
        icon={Calculator}
        className="mt-5"
      >
        <Alert variant="info" className="mb-4">
          <p className="font-semibold">¿Qué prima se cobra?</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            <li>
              <strong>Manda la tabla por edad:</strong> al cotizar o emitir, Sis2000 busca el tramo de la edad de cada
              asegurado y cobra la prima de ese tramo o, si el tramo trae tasa %, la tasa × la suma asegurada.
            </li>
            <li>
              La <strong>prima por persona</strong> de la cobertura es opcional y no reemplaza a la tabla: déjala en 0 si
              la prima sale de la tabla.
            </li>
            <li>
              Si la edad de una persona no cae en ningún tramo de la tabla, esa persona queda con <strong>prima 0</strong>{' '}
              sin aviso. Revisa que los tramos cubran todas las edades del plan.
            </li>
          </ul>
        </Alert>
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-slate-50/60 p-3 text-sm">
          <span className="font-semibold">Tabla para todas las coberturas:</span>
          {tablaPlan.trim() ? (
            <Badge variant="submitted">{nombreTabla(tablaPlan.trim())}</Badge>
          ) : (
            <span className="text-muted-foreground">ninguna</span>
          )}
          <Button type="button" size="sm" onClick={() => abrirBuscadorTabla('plan')} disabled={!incluidas.length}>
            <Search className="h-3.5 w-3.5" />
            Elegir tabla existente
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => abrirCrearTabla('plan')}>
            Crear tabla nueva
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!tablaPlan.trim() || !Object.values(filasPer).some((x) => x.ctablatar.trim())}
            onClick={usarTablaDelPlanEnTodas}
            title="Quita la tabla propia de cada cobertura para que todas cobren con la tabla del plan."
          >
            Usar esta en todas
          </Button>
        </div>
        {!incluidas.length ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Marca coberturas en el paso 2 para ponerles suma y tabla.
          </p>
        ) : (
          <ListaAnimada className="space-y-3">
            {incluidas.map((v) => {
              const cc = v.cobertura.ccobertura;
              const propia = filaPer(cc).ctablatar.trim();
              const tabla = tablaDe(cc);
              const leida = tabla ? tablasLeidas[tabla.toUpperCase()] : undefined;
              return (
                <li key={cc} className="rounded-xl border border-border/60 bg-white p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">{nombreCob(v)}</p>
                    <Badge variant={filaPer(cc).obligatoria ? 'submitted' : 'default'} className="px-2 py-0 text-[10px]">
                      {filaPer(cc).obligatoria ? 'Obligatoria' : 'Opcional'}
                    </Badge>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {selectorTarifa(v)}
                    <FormField
                      label="Suma asegurada por persona"
                      hint="Ejemplo: 5000. Sugerida por la tarifa; 0 si la suma sale de la tabla."
                      tooltip={'Suma asegurada de cada persona en esta cobertura. Si el tramo de la tabla trae tasa %, la prima es suma × tasa / 100; si trae prima fija, la suma no la cambia.\nEn Sis2000: mapltarifas_per.msumamax'}
                    >
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        id={`per-suma-${cc}`}
                        data-cob={cc}
                        aria-label={`Suma asegurada de ${nombreCob(v)}`}
                        value={v.fila.msumamax}
                        onChange={(e) => cambiarFila(cc, { msumamax: e.target.value })}
                      />
                    </FormField>
                    <FormField
                      label="Prima por persona (opcional)"
                      hint="Déjala en 0 si la prima sale de la tabla por edad."
                      tooltip={'Monto que se guarda con la cobertura para cada persona. No reemplaza a la tabla por edad: al cotizar y emitir, la prima sale del tramo de edad de la tabla.\nEn Sis2000: mapltarifas_per.mprima'}
                    >
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        id={`per-prima-${cc}`}
                        data-cob={cc}
                        aria-label={`Prima por persona de ${nombreCob(v)}`}
                        value={v.fila.mprima}
                        onChange={(e) => cambiarFila(cc, { mprima: e.target.value })}
                      />
                    </FormField>
                    <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
                      <span className="flex items-center gap-1.5 text-[0.78rem] font-bold tracking-wide text-slate-600">
                        Tabla de precios por edad *
                        <InfoTip text={'Tramos de edad con la prima o la tasa de cada uno. Al cotizar y emitir se busca el tramo de la edad de cada asegurado; si no hay tramo para esa edad, la prima queda en 0. Ejemplo: 0–17, 18–64, 65–74.\nEn Sis2000: mapltarifas_per.ctablatar → mapltabedad_d'} />
                      </span>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {tabla ? (
                          <Badge variant={propia ? 'submitted' : 'default'} className="px-2 py-0.5 text-[11px]">
                            {nombreTabla(tabla)}
                            {!propia && ' · la del plan'}
                          </Badge>
                        ) : (
                          <span className="font-semibold text-rose-600">Sin tabla</span>
                        )}
                        {leida === 'error' && <span className="text-rose-600">no existe en Sis2000</span>}
                        {leida && leida !== 'error' && leida !== 'cargando' && (
                          <span className="text-muted-foreground">
                            {(leida.tramos ?? []).length} tramo{(leida.tramos ?? []).length === 1 ? '' : 's'} de edad
                          </span>
                        )}
                        <Button
                          id={`per-tabla-${cc}`}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => abrirBuscadorTabla(cc, v.cobertura.descripcion)}
                        >
                          Elegir
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => abrirCrearTabla(cc, v.cobertura.descripcion)}>
                          Crear
                        </Button>
                        <Button type="button" size="sm" variant="ghost" disabled={!tabla} onClick={() => abrirVerTabla(tabla)}>
                          Ver tramos
                        </Button>
                      </div>
                    </div>
                  </div>
                  {(intentoCrear || cobTocadas.has(cc)) && faltasCob(cc).length > 0 && (
                    <ul className="mt-3 space-y-0.5 text-[0.72rem] font-semibold text-rose-600" role="alert">
                      {faltasCob(cc).map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ListaAnimada>
        )}
        {avisosPersonas.length > 0 && (
          <Alert variant="warning" className="mt-3">
            <ul className="list-disc space-y-0.5 pl-5">
              {avisosPersonas.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </Alert>
        )}
      </SectionPanel>
    </>
  );

  const pasoPrecios = (
    <>
      <ComoSeUsa id={personas ? 'combo-precios-personas' : 'combo-precios-cosas'}>
        {personas ? (
          <>
            <p>Indica quiénes pueden asegurarse y con qué tabla se calcula el precio de cada cobertura.</p>
            <ol className="list-decimal space-y-0.5 pl-5">
              <li>Marca los parentescos (Titular, Cónyuge, Hijos…) y el rango de edades de entrada del plan.</li>
              <li>
                Elige una tabla de precios por edad para todas o una por cobertura. Si no existe, créala. Sus tramos deben
                cubrir todo el rango de edades: una edad sin tramo deja la prima en 0.
              </li>
              <li>Revisa la suma asegurada por persona de cada cobertura.</li>
            </ol>
            <p className="text-sky-800">
              Ejemplo: Titular e Hijos de 0 a 74 años, con una tabla de tramos 0–17, 18–64 y 65–74.
            </p>
          </>
        ) : (
          <>
            <p>Para cada cobertura indica cuánto se puede asegurar y cómo se cobra.</p>
            <ol className="list-decimal space-y-0.5 pl-5">
              <li>
                <strong>Suma asegurada:</strong> de una mínima a una máxima. Si deben ser iguales (suma fija), usa el botón
                «=».
              </li>
              <li>
                <strong>¿Cómo se cobra?</strong> elige <em>Tasa %</em> (porcentaje de la suma) o <em>Prima fija</em> (monto
                fijo). Son excluyentes: solo una de las dos.
              </li>
              <li>
                En automóvil, si el plan tiene tasa por antigüedad, esa tasa manda sobre la tasa de casco que pongas aquí;
                y la prima base de RCV puede salir del tipo y uso. Las dos se cargan después en la ficha del plan.
              </li>
            </ol>
            <p className="text-sky-800">
              Ejemplo: suma de 1.000 a 50.000 con tasa 0,5 % → con 50.000 asegurados la prima es 250.
            </p>
          </>
        )}
      </ComoSeUsa>
      {conTarifaVencida.length > 0 && (
        <div className="mb-4 space-y-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Estas coberturas del plan tienen una tarifa que ya no está vigente. Elige una vigente para poder guardar
            (se conservan los montos del plan).
          </p>
          {conTarifaVencida.map((v) => (
            <div key={v.cobertura.ccobertura}>
              <p className="mb-2 text-sm font-semibold">{nombreCob(v)}</p>
              {selectorTarifa(v)}
            </div>
          ))}
        </div>
      )}
      {personas ? pasoPreciosPersonas : pasoPreciosCosas}
      <DetallesTecnicos>
        <p>
          {personas
            ? 'Se graban por parentesco en mapltarifas_per (msuma, msumamax, mprima, ctablatar), las edades en mapledades_per y la obligatoriedad en maplcober_per. Tablas por edad: mapltabedad / mapltabedad_d.'
            : 'Se graban en maplantar: msumamin, msumamax, mprima (prima fija) y pprima (tasa %). Solo una de mprima/pprima va con valor; la otra en 0.'}
        </p>
        {incluidas.length > 0 && (
          <p>
            {incluidas
              .map((v) => `${v.cobertura.ccobertura}/${v.fila.ctarifa}${personas ? ` → ${tablaDe(v.cobertura.ccobertura) || 'sin tabla'}` : ''}`)
              .join(' · ')}
          </p>
        )}
      </DetallesTecnicos>
    </>
  );

  // ── Paso 4: Datos del plan ──
  const pasoDatos = (
    <>
      <ComoSeUsa id="combo-datos">
        <p>Los datos que identifican al plan y cómo se vende.</p>
        <ul className="list-disc space-y-0.5 pl-5">
          <li>
            El <strong>código</strong> es corto (máx. 6) y conviene que no se repita en ningún ramo: varios cálculos buscan
            el plan solo por su código. El <strong>nombre</strong> es el que ven SysIP y la emisión.
          </li>
          <li>
            Las fechas de <strong>vigencia</strong> quedan como referencia: hoy cotización y emisión solo miran si el plan
            está activo, no estas fechas.
          </li>
          <li>
            <strong>Formas de pago:</strong> en cuántas cuotas se puede pagar (anual, semestral, trimestral, mensual…).
          </li>
          <li>
            <strong>Quién lo ofrece:</strong> los productores (y canales, si está habilitado) que podrán verlo al emitir.
            Sin nadie asignado, el plan no aparece para emitir.
          </li>
        </ul>
      </ComoSeUsa>
      <SectionPanel title="Identificación y vigencia" icon={FileText}>
        <FormGrid>
          <FormField
            label="Nombre del plan *"
            htmlFor="combo-xplan"
            hint="Como lo verán SysIP y la emisión. Ejemplo: RC GENERAL PLAN BÁSICO. Máx. 60."
            tooltip={`Nombre del plan que aparece al cotizar y emitir y en la póliza.\nEn Sis2000: ${personas ? 'maplanes_per' : 'maplanes'}.xplan`}
            error={errorDe('combo-xplan')}
          >
            <Input id="combo-xplan" value={xplan} maxLength={60} onChange={(e) => setXplan(e.target.value)} />
          </FormField>
          <FormField
            label="Código del plan *"
            htmlFor="combo-cplan"
            hint={modoEdicion ? 'El código de un plan existente no cambia.' : 'Corto y sin repetir (máx. 6, en mayúsculas). Ejemplo: RCG01.'}
            tooltip={`Con el ramo identifica el plan; es el que usan cotización y emisión. Úsalo único en todo Sis2000, no solo en el ramo: varios cálculos buscan el plan solo por este código y uno repetido en otro ramo puede tomar coberturas o comisiones ajenas.\nEn Sis2000: ${personas ? 'maplanes_per' : 'maplanes'}.cplan`}
            error={errorDe('combo-cplan')}
          >
            <Input
              id="combo-cplan"
              value={cplan}
              maxLength={6}
              placeholder="RCG01"
              disabled={modoEdicion}
              onChange={(e) => setCplan(e.target.value.toUpperCase().replace(/\s/g, ''))}
            />
          </FormField>
          <FormField
            label="Se puede emitir desde *"
            htmlFor="combo-fdesde"
            hint="Normalmente hoy."
            tooltip={`Inicio de la vigencia del plan; también marca la versión del plan. Ojo: hoy cotización y emisión no miran esta fecha, solo que el plan esté activo.\nEn Sis2000: ${personas ? 'maplanes_per' : 'maplanes'}.fdesde_plan`}
            error={errorDe('combo-fdesde')}
          >
            <Input id="combo-fdesde" type="date" value={fdesde} onChange={(e) => setFdesde(e.target.value)} />
          </FormField>
          <FormField
            label="Se puede emitir hasta *"
            htmlFor="combo-fhasta"
            hint="Si no tiene fin, deja 31/12/2099."
            tooltip={`Fin de la vigencia del plan. Es referencia: pasada esta fecha el plan se sigue ofreciendo mientras esté activo; para dejar de venderlo hay que desactivarlo.\nEn Sis2000: ${personas ? 'maplanes_per' : 'maplanes'}.fhasta_plan`}
            error={errorDe('combo-fhasta')}
          >
            <Input id="combo-fhasta" type="date" value={fhasta} onChange={(e) => setFhasta(e.target.value)} />
          </FormField>
          <FormField
            label="Moneda *"
            htmlFor="combo-cmoneda"
            error={errorDe('combo-cmoneda')}
            hint="Se sugiere la que usan las coberturas del ramo."
            tooltip={`Moneda en la que se expresan las sumas y primas del plan y en la que se emite. Un plan tiene una sola moneda. Ejemplo: $ (dólares).\nEn Sis2000: ${personas ? 'maplanes_per' : 'maplanes'}.cmoneda`}
          >
            {monedas.length ? (
              <ComboBuscable
                id="combo-cmoneda"
                ariaLabel="Moneda"
                placeholder="Escribe la moneda…"
                value={cmoneda}
                onChange={setCmoneda}
                opciones={opcionesDeMoneda.map((m) => ({
                  valor: m.codigo,
                  etiqueta: m.nombre ? `${m.nombre} (${m.codigo})` : m.codigo,
                }))}
              />
            ) : (
              <Input id="combo-cmoneda" value={cmoneda} maxLength={3} onChange={(e) => setCmoneda(e.target.value)} />
            )}
          </FormField>
          <FormField
            label="Formas de pago *"
            hint="Cómo puede fraccionar el pago el asegurado. Marca al menos una."
            tooltip={'Fraccionamientos que se ofrecen al emitir. Cada letra fija el número de cuotas: A anual (1), S semestral (2), C cuatrimestral (3), T trimestral (4), M mensual (12), E evento o pago único (1). Sin ninguna, el plan no se puede ofrecer.\nEn Sis2000: maplanes_frec.ifrecuencia'}
            error={errorDe('combo-frecuencias')}
          >
            <div id="combo-frecuencias" className="flex flex-wrap gap-2">
              {opcionesFrecuencia.map((f) => (
                <label key={f.ifrecuencia} className={ETIQUETA_OPCION}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={frecuencias.includes(f.ifrecuencia)}
                    onChange={(e) => alternarFrecuencia(f.ifrecuencia, e.target.checked)}
                  />
                  {f.xfrecuencia}
                </label>
              ))}
            </div>
          </FormField>
          <FormField
            span={2}
            label="Observaciones del plan"
            htmlFor="combo-xobservacion"
            hint="Opcional. Nota interna del plan (máx. 255); no la ve el asegurado. Ejemplo: Plan aprobado en comité del 04/11."
            error={errorDe('combo-xobservacion')}
          >
            <textarea
              id="combo-xobservacion"
              className="min-h-[64px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              maxLength={255}
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
            />
          </FormField>
        </FormGrid>
      </SectionPanel>

      <SectionPanel title="¿Quién puede ofrecer el plan?" icon={Users} className="mt-5">
        <FormGrid>
          <FormField
            span={2}
            label="Productores *"
            error={errorDe('combo-prod-buscar')}
            hint="Busca por nombre o código y elige uno o varios, o «Todos los productores»."
            tooltip={'Productores que podrán ver y emitir el plan. «Todos los productores» se graba sin código y vale para cualquiera; si eliges algunos, solo ellos lo verán. Las exclusiones se manejan en la ficha del plan.\nEn Sis2000: mausuplan (centidad P, itipouso A)'}
          >
            <ProductoresSelector idPrefix="combo-prod" value={productoresSel} onChange={setProductoresSel} />
          </FormField>
          <FormField
            span={2}
            label="Canales"
            hint={canalesHabilitados ? 'Opcional. Canales (por ejemplo, aliados comerciales) que también podrán ofrecerlo. Solo se agregan; no se quitan.' : 'Por ahora el servidor no permite asignar canales desde aquí.'}
            tooltip={'Canales de venta que también podrán ofrecer el plan, además de los productores. Desde aquí solo se agregan; para quitar uno o excluirlo usa «Quién vende» en la ficha del plan.\nEn Sis2000: mausuplan (centidad C, itipouso A)'}
          >
            <CanalesSelector idPrefix="combo-canal" value={canalesSel} onChange={setCanalesSel} deshabilitado={!canalesHabilitados} />
          </FormField>
        </FormGrid>
      </SectionPanel>

      {/* Igual que en Planes maestro: antes de crear quedan pendientes y se agregan al crear el plan. */}
      <ProveedoresPlanPanel
        key={proveedoresKey}
        className="mt-5"
        planId={modoEdicion && editId ? editId : planGuardado ? sis2000PlanMasterId(planGuardado.cramo, planGuardado.cplan) : null}
        onCambio={() => setVersionHistorial((n) => n + 1)}
      />
      {/* Tipo de emisión (cobro por días): como los proveedores, antes de crear queda pendiente y se guarda al
          crear el plan. Si no se activa, nada cambia. */}
      <CobroDiasPanel
        key={`cd-${proveedoresKey}`}
        className="mt-5"
        planId={modoEdicion && editId ? editId : planGuardado ? sis2000PlanMasterId(planGuardado.cramo, planGuardado.cplan) : null}
        coberturas={incluidas.map((v) => ({ ccobertura: v.cobertura.ccobertura, nombre: v.cobertura.descripcion }))}
        obligatorias={incluidas
          .filter((v) => (personas ? filaPer(v.cobertura.ccobertura).obligatoria : v.obligatoria))
          .map((v) => v.cobertura.ccobertura)}
        cmonedaDefault={cmoneda.trim() || '$'}
      />
      <DetallesTecnicos>
        <p>
          Cabecera en {personas ? 'maplanes_per' : 'maplanes'} (cplan, xplan, fdesde, fhasta, cmoneda, xobservacion), formas de pago
          en maplanes_frec, productores y canales en mausuplan. Proveedores en maplprov_per.
        </p>
      </DetallesTecnicos>
    </>
  );

  // ── Paso 5: Revisar y confirmar ──
  const listaCoberturasTexto = (
    <ListaAnimada className="space-y-1.5">
      {incluidas.map((v) => (
        <li key={v.cobertura.ccobertura} className="rounded-lg border border-border/40 bg-white px-3 py-2">
          <span className="font-semibold">{nombreCob(v)}</span>
          <span className="text-muted-foreground">
            {' '}
            · {(personas ? filaPer(v.cobertura.ccobertura).obligatoria : v.obligatoria) ? 'obligatoria' : 'opcional'}
            {delPlan.has(v.cobertura.ccobertura) || !modoEdicion ? '' : ' · nueva en el plan'}
          </span>
          <span className="block text-xs text-slate-600">{descripcionPrecio(v)}</span>
        </li>
      ))}
    </ListaAnimada>
  );

  const pasoRevisar = (
    <>
      <ComoSeUsa id="combo-revisar">
        <p>
          Lee el resumen: es exactamente lo que se {modoEdicion ? 'guardará en el plan' : 'creará'} en Sis2000. Si algo no
          está bien, usa «Cambiar» o la barra de pasos para volver. Al confirmar se escribe en Sis2000 y queda una copia en
          el historial para poder restaurarlo.
        </p>
      </ComoSeUsa>
      <SectionPanel
        title={modoEdicion ? 'Revisa los cambios antes de guardar' : 'Revisa el plan antes de crearlo'}
        icon={ClipboardCheck}
      >
        {faltas.length > 0 ? (
          <Alert variant="warning" className="mb-4">
            <p className="font-semibold">
              Falta{faltas.length === 1 ? '' : 'n'} {faltas.length} cosa{faltas.length === 1 ? '' : 's'}:
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {faltas.map((f, i) => (
                <li key={`rev-${i}-${f.texto}`}>
                  {f.texto}{' '}
                  <button
                    type="button"
                    className="font-semibold underline"
                    onClick={() => (f.campo ? irACampoDelPaso(f.campo) : irAPaso(PASOS.findIndex((p) => p.id === f.paso)))}
                  >
                    Ir a «{PASOS.find((p) => p.id === f.paso)?.titulo}»
                  </button>
                </li>
              ))}
            </ul>
          </Alert>
        ) : (
          !planGuardado && (
            <Alert variant="success" className="mb-4">
              Todo listo. Revisa el resumen y pulsa «{modoEdicion ? 'Guardar cambios' : 'Crear plan'}».
            </Alert>
          )
        )}

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 text-sm leading-relaxed text-slate-800">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-indigo-700">En pocas palabras</p>
          <p>
            Se va a {accion} plan <strong>«{tituloPlan}»</strong> (código {cplan.trim() || '—'}) del producto{' '}
            <strong>{nombreProducto || '—'}</strong>
            {nombreRamo ? <> en {nombreRamo}</> : null}, para asegurar <strong>{personas ? 'personas' : 'cosas'}</strong>.
          </p>
          <p>
            Se podrá emitir del <strong>{fechaCorta(fdesde) || '—'}</strong> al <strong>{fechaCorta(fhasta) || '—'}</strong>, en{' '}
            <strong>{cmoneda || '—'}</strong>, con pago <strong>{textoFrecuencias.toLowerCase()}</strong>. Lo podrán ofrecer{' '}
            <strong>{textoProductores}</strong>
            {textoCanales ? <> y {textoCanales}</> : null}.
          </p>
          {personas && (
            <p>
              Asegura a: <strong>{textoParentescos}</strong> ({textoSexo.toLowerCase()}), de <strong>{edadMin || '—'}</strong> a{' '}
              <strong>{edadMax || '—'}</strong> años.
            </p>
          )}
          <p className="mt-2">
            Tendrá <strong>{incluidas.length}</strong> cobertura{incluidas.length === 1 ? '' : 's'}
            {!personas && incluidas.length > 0 && (
              <>
                {' '}
                y una prima de referencia de <strong>{cmoneda} {formatoMonto(resumen.prima)}</strong> con las sumas máximas
              </>
            )}
            :
          </p>
          <div className="mt-2">{incluidas.length ? listaCoberturasTexto : <p className="text-muted-foreground">Ninguna todavía.</p>}</div>
          {observacion.trim() && <p className="mt-2 text-xs">Observaciones: {observacion.trim()}</p>}
        </div>

        {modoEdicion && (
          <div className="mt-4 rounded-2xl border border-border/60 p-4">
            <p className="mb-2 text-sm font-semibold">Qué cambia frente a lo que está hoy en Sis2000</p>
            {cambios.length ? (
              <ul className="list-disc space-y-0.5 pl-5 text-sm">
                {cambios.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No hay cambios: el plan quedaría igual.</p>
            )}
          </div>
        )}

        {[...avisosPersonas, ...avisosCosas].length > 0 && (
          <Alert variant="warning" className="mt-4">
            <ul className="list-disc space-y-0.5 pl-5">
              {[...avisosPersonas, ...avisosCosas].map((a) => (
                <li key={`rev-${a}`}>{a}</li>
              ))}
            </ul>
          </Alert>
        )}

        <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {(
            [
              ['Producto', nombreProducto || '—', 'producto'],
              ['Tipo de plan', personas ? 'Personas' : 'Cosas (patrimonial)', 'producto'],
              ['Coberturas', `${incluidas.length} marcada${incluidas.length === 1 ? '' : 's'}`, 'coberturas'],
              ['Montos y precios', personas ? 'Por tabla de edad' : 'Suma y tasa o prima', 'precios'],
              ['Nombre y código', `${tituloPlan} (${cplan.trim() || '—'})`, 'datos'],
              ['Quién lo ofrece', textoProductores, 'datos'],
            ] as Array<[string, string, PasoId]>
          ).map(([etiqueta, valor, p]) => (
            <div key={etiqueta} className="flex items-baseline justify-between gap-3 border-b border-border/40 py-1">
              <dt className="text-muted-foreground">{etiqueta}</dt>
              <dd className="flex items-baseline gap-2 text-right font-medium">
                <span className="break-words">{valor}</span>
                <button
                  type="button"
                  className="text-[11px] font-normal text-primary hover:underline"
                  onClick={() => irAPaso(PASOS.findIndex((x) => x.id === p))}
                >
                  Cambiar
                </button>
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 max-w-xl">
          <FormField
            label="Motivo del cambio (opcional)"
            htmlFor="combo-motivo"
            hint="Queda en el historial del configurador junto con la copia de lo anterior. Ejemplo: Ajuste de tasas aprobado por Técnica."
          >
            <Input id="combo-motivo" value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />
          </FormField>
        </div>

        <AlertaError
          className="mt-4"
          titulo={modoEdicion ? 'No se pudieron guardar los cambios del plan' : 'No se pudo crear el plan'}
          error={errorCrear}
          onReintentar={() => void guardarPlan()}
          reintentando={creando}
          idDeCampo={(prop, indice) => {
            const cc = indice !== undefined ? incluidas[indice]?.cobertura.ccobertura : undefined;
            if (cc && ['msumamin'].includes(prop)) return `p-min-${cc}`;
            if (cc && ['msumamax', 'msuma'].includes(prop)) return personas ? `per-suma-${cc}` : `p-max-${cc}`;
            if (cc && ['mprima', 'pprima'].includes(prop)) return personas ? `per-prima-${cc}` : `p-valor-${cc}`;
            if (cc && prop === 'ctablatar') return `per-tabla-${cc}`;
            if (cc && prop === 'ctarifa') return `p-tarifa-${cc}`;
            return idCampoPlan(prop);
          }}
          onIrCampo={irACampoDelPaso}
        />
        {errorCrear && <p className="mt-1 text-xs text-muted-foreground">Lo que llenaste sigue en esta pantalla.</p>}

        {planGuardado && (
          <Alert variant="success" className="mt-4">
            <p className="font-semibold">
              {planGuardado.editado ? 'Cambios guardados' : 'Plan creado'} en Sis2000: «{tituloPlan}» ({planGuardado.cplan}).
            </p>
            <p className="mt-1 text-xs">
              {planGuardado.editado
                ? 'Lo anterior quedó en el historial (más abajo) y se puede restaurar.'
                : 'Ya se puede usar en la emisión. Si elegiste proveedores o cobro por días, se agregaron al plan.'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {gruposPlan.length > 0 && (
                <Button type="button" size="sm" onClick={() => irAPaso(PASOS.length)}>
                  Seguir aquí: completar el plan
                </Button>
              )}
              <Link
                to={`/sis2000/plans/${encodeURIComponent(sis2000PlanMasterId(planGuardado.cramo, planGuardado.cplan))}/configurar${planGuardado.editado ? '' : '?asistente=1'}`}
              >
                <Button type="button" size="sm" variant={gruposPlan.length > 0 ? 'outline' : 'default'}>
                  {planGuardado.editado
                    ? 'Ir a la ficha del plan'
                    : planGuardado.automovil
                      ? 'Abrir la ficha: tipo y uso, tasas por antigüedad, deducibles, comisiones y revisión'
                      : 'Abrir la ficha: deducibles, comisiones y revisión'}
                </Button>
              </Link>
              {(planGuardado.tipo === 'cosas' || planGuardado.cotizarPersona) && (
                <Button type="button" variant="outline" size="sm" onClick={cotizar} disabled={cotizando}>
                  <Calculator className="h-3.5 w-3.5" />
                  {cotizando ? 'Cotizando…' : 'Probar cotización en Sis2000'}
                </Button>
              )}
              {!planGuardado.editado && (
                <>
                  <Link
                    to={`/sis2000/plans/${encodeURIComponent(sis2000PlanMasterId(planGuardado.cramo, planGuardado.cplan))}/edit`}
                    className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Editar este plan
                  </Link>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                    onClick={() => empezarDeCero(false)}
                  >
                    Crear otro plan
                  </button>
                </>
              )}
            </div>
          </Alert>
        )}

        <AlertaError
          className="mt-3"
          titulo="No se pudo probar la cotización"
          error={errorCotizar}
          onReintentar={() => void cotizar()}
          reintentando={cotizando}
        />

        {cotizacion && planGuardado && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-border/50">
            <p className="border-b border-border/50 bg-muted/30 px-2 py-2 text-xs font-semibold">
              Cotización de prueba · pago{' '}
              {(opcionesFrecuencia.find((f) => f.ifrecuencia === planGuardado.ifrecuencia)?.xfrecuencia ?? planGuardado.ifrecuencia).toLowerCase()}
              {planGuardado.cotizarPersona &&
                ` · parentesco ${planGuardado.cotizarPersona.cparen}, ${planGuardado.cotizarPersona.nedad} años`}
              {Number(cotizacion[0]?.ptasamon) > 0 && ` · tasa ${Number(cotizacion[0]?.ptasamon).toLocaleString('es-VE')} (mamonedas)`}
            </p>
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2">Cobertura</th>
                  <th className="p-2 text-right">Suma asegurada</th>
                  <th className="p-2 text-right">Prima</th>
                  <th className="p-2 text-right">Comisión</th>
                </tr>
              </thead>
              <tbody>
                {cotizacion.map((r, i) => (
                  <tr key={`${String(r.ccober)}-${i}`} className="border-t border-border/50">
                    <td className="p-2">{texto(r.xcobertura) || texto(r.ccober)}</td>
                    <td className="p-2 text-right">{Number(r.msumaasegext ?? 0).toLocaleString('es-VE')}</td>
                    <td className="p-2 text-right">{Number(r.mprimaext ?? 0).toLocaleString('es-VE')}</td>
                    <td className="p-2 text-right">{Number(r.mcomisionext ?? 0).toLocaleString('es-VE')}</td>
                  </tr>
                ))}
                <tr className="border-t border-border font-semibold">
                  <td className="p-2">Total ({cmoneda})</td>
                  <td className="p-2" />
                  <td className="p-2 text-right">{totalCotizacion('mprimaext').toLocaleString('es-VE')}</td>
                  <td className="p-2 text-right">{totalCotizacion('mcomisionext').toLocaleString('es-VE')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <DetallesTecnicos>
          <p>
            {modoEdicion ? (
              <>
                nest-api <code>PUT /api/v1/configurador/planes/{cramo}/{cplan.trim()}</code> → {tipoPlan === 'personas' ? 'SQL propio en una transacción' : 'spMantPlanes (U)'}
              </>
            ) : (
              <>
                nest-api <code>POST /api/v1/configurador/planes</code> → {tipoPlan === 'personas' ? 'SQL propio en una transacción' : 'spMantPlanes (C)'}
              </>
            )}{' '}
            · tablas {personas ? 'maplanes_per, maplcober_per, mapltarifas_per, mapledades_per' : 'maplanes, maplantar'}, maplanes_frec,
            mausuplan. Canales: <code>POST …/planes/:cramo/:cplan/canales</code> (solo alta).
          </p>
          <pre className="max-h-72 overflow-auto rounded-lg bg-white p-2 font-mono text-[11px] text-slate-700">
            {(() => {
              try {
                return JSON.stringify(armarPayload(), null, 2);
              } catch {
                return '—';
              }
            })()}
          </pre>
        </DetallesTecnicos>
      </SectionPanel>

      {modoEdicion && editId && (
        <HistorialPanel
          entidad="PLAN"
          clave={claveHistorial.plan(editId.split('-')[0], editId.split('-').slice(1).join('-'))}
          recargar={versionHistorial}
          onRestaurado={() => window.location.reload()}
        />
      )}
    </>
  );

  const botonGuardar = guardarPisaria ? (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-amber-900">
        Cambiaste el plan en los pasos siguientes. Vuelve a cargarlo para editar estos datos sin borrar esos cambios.
      </span>
      <Button type="button" variant="outline" onClick={() => window.location.reload()}>
        Volver a cargar el plan
      </Button>
    </div>
  ) : (
    <Button type="button" onClick={pedirConfirmacion} disabled={creando || Boolean(planGuardado && !modoEdicion)}>
      <Send className="h-4 w-4" />
      {creando ? 'Guardando…' : modoEdicion ? 'Guardar cambios' : 'Crear plan en Sis2000'}
    </Button>
  );

  // Buscador Ctrl+K: pasos de este asistente y ramos ya cargados (sin llamadas nuevas).
  useRegistrarComandos('combo', [
    ...[...PASOS, ...pasosCompletar].map((p, i) => ({
      id: `combo-paso-${i}`,
      grupo: 'Pasos del combo' as const,
      titulo: `Paso ${i + 1}: ${p.titulo}`,
      detalle: p.resumen,
      ejecutar: () => irAPaso(i),
    })),
    ...comandosDeRamos(ramosSis2000),
  ]);

  const contenidoPasos: ReactNode[] = [pasoProducto, pasoCoberturas, pasoPrecios, pasoDatos, pasoRevisar];

  return (
    <AppShell title={modoEdicion ? 'Editar plan' : 'Combos de coberturas'}>
      <div ref={arriba} className="scroll-mt-4" />
      {encabezado}

      {borradorRestaurado && !planGuardado && (
        <Alert variant="info" className="mb-3">
          Recuperamos lo que habías llenado antes en este navegador. Revisa los datos; si prefieres empezar otro plan, usa
          «Empezar de cero».
        </Alert>
      )}

      <BarraPasos pasos={[...PASOS, ...pasosCompletar]} actual={paso} estado={estadoPaso} onIr={irAPaso} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0">
          {/* Todos los pasos quedan montados (los paneles de proveedores y cobro por días guardan lo pendiente). */}
          {contenidoPasos.map((contenido, i) => (
            <PasoAnimado key={PASOS[i].id} activo={i === paso} data-paso={i} onBlurCapture={registrarBlur}>
              {contenido}
            </PasoAnimado>
          ))}
          <CompletarPlan
            grupos={gruposPlan}
            activo={grupoActivo}
            visitados={gruposVistos}
            planId={planIdCompletar}
            cramo={cramoCompletar}
            datos={completar}
            onIrSeccion={irASeccionDelPlan}
          />
          {paso >= PASOS.length && gruposPlan[paso - PASOS.length] ? (
            <NavegacionPasos
              actual={paso}
              total={totalPasos}
              onAtras={() => irAPaso(paso - 1)}
              onSiguiente={() => irAPaso(paso + 1)}
              faltan={[]}
              mostrarFaltan={false}
              etiquetaSiguiente={`Siguiente: ${gruposPlan[paso - PASOS.length + 1]?.titulo ?? ''}`}
              accionFinal={
                planIdCompletar ? (
                  <Link to={`/sis2000/plans/${encodeURIComponent(planIdCompletar)}/configurar`}>
                    <Button type="button" variant="outline">
                      Abrir la ficha del plan
                    </Button>
                  </Link>
                ) : undefined
              }
            />
          ) : (
          <NavegacionPasos
            actual={paso}
            total={PASOS.length}
            onAtras={() => irAPaso(paso - 1)}
            onSiguiente={siguiente}
            faltan={faltasDe(paso)}
            onIrCampo={irACampoDelPaso}
            mostrarFaltan={avisoPaso === paso}
            etiquetaSiguiente={paso === PASOS.length - 2 ? 'Revisar' : undefined}
            accionFinal={botonGuardar}
          />
          )}
        </div>

        <div className={ayudasActivas ? 'h-fit space-y-4 xl:sticky xl:top-28' : 'contents'}>
        <Card className="hidden h-fit xl:sticky xl:top-28 xl:block">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tu plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p>
              <span className="text-muted-foreground">Producto:</span> {nombreProducto || '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Tipo:</span> {personas ? 'Personas' : 'Cosas'}
            </p>
            <p>
              <span className="text-muted-foreground">Coberturas:</span> {incluidas.length}
            </p>
            {!personas && (
              <p>
                <span className="text-muted-foreground">Prima de referencia:</span> {cmoneda} {formatoMonto(resumen.prima)}
              </p>
            )}
            {personas && (
              <p>
                <span className="text-muted-foreground">Asegurados:</span> {textoParentescos}, {edadMin || '—'} a {edadMax || '—'} años
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Plan:</span> {xplan.trim() || '—'}
            </p>
            <p className={cn('pt-1 font-semibold', faltas.length ? 'text-amber-700' : 'text-emerald-700')}>
              {faltas.length ? `Faltan ${faltas.length} dato${faltas.length === 1 ? '' : 's'}` : 'Listo para revisar'}
            </p>
          </CardContent>
        </Card>
        <PanelAyudas
          pasos={PASOS.slice(0, PASOS.length - 1).map((p, i) => ({ indice: i, titulo: p.titulo, faltas: faltasDe(i).map((f) => f.texto) }))}
          grupos={gruposPlan.map((g, i) => ({ indice: PASOS.length + i, titulo: g.titulo, estado: estadoDeGrupo(g) }))}
          resumen={{
            modoEdicion,
            cplan,
            nombrePlan: xplan,
            producto: nombreProducto,
            personas,
            coberturas: incluidas.length,
            moneda: cmoneda,
            formasDePago: frecuencias.length,
          }}
          auto={{
            mostrar: (automovil || completar.ramo?.familia === 'auto') && gruposPlan.some((g) => g.secciones.includes('tarifa-dias')),
            sumaInicial: resumen.sumaMaxima,
            moneda: cmoneda,
          }}
          mapa={{
            producto: nombreProducto,
            plan: [cplan.trim(), xplan.trim()].filter(Boolean).join(' · '),
            coberturas: incluidas.map((v) => ({
              codigo: v.cobertura.ccobertura,
              nombre: nombreCob(v),
              tarifa: personas ? (filaPer(v.cobertura.ccobertura).ctablatar.trim() || tablaPlan.trim()) : formatTarifaDescripcion(v.tarifa),
            })),
            tablasEdad: Object.entries(tablasLeidas).flatMap(([codigo, t]) =>
              typeof t === 'object'
                ? [{ codigo, nombre: t.xtablaedad, tramos: t.tramos.map((x) => ({ desde: x.nedad_min, hasta: x.nedad_max, tasa: x.pprima, prima: x.mprima })) }]
                : [],
            ),
          }}
          paso={paso}
          onIr={irAPaso}
        />
        </div>
      </div>

      {confirmando && (
        <ConfirmarDialog
          titulo={modoEdicion ? '¿Guardar los cambios en Sis2000?' : '¿Crear el plan en Sis2000?'}
          confirmar={creando ? 'Guardando…' : modoEdicion ? 'Sí, guardar cambios' : 'Sí, crear el plan'}
          ocupado={creando}
          onCancelar={() => setConfirmando(false)}
          onConfirmar={() => void guardarPlan()}
        >
          <p>
            Se va a {accion} plan <strong>«{tituloPlan}»</strong> ({cplan.trim()}) del producto <strong>{nombreProducto}</strong> con{' '}
            {incluidas.length} cobertura{incluidas.length === 1 ? '' : 's'}.
          </p>
          {modoEdicion && cambios.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-xs">
              {cambios.slice(0, 8).map((c) => (
                <li key={`conf-${c}`}>{c}</li>
              ))}
              {cambios.length > 8 && <li>… y {cambios.length - 8} cambio(s) más.</li>}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Esto escribe en Sis2000. Queda una copia de lo anterior en el historial del configurador para poder restaurarlo.
          </p>
        </ConfirmarDialog>
      )}

      {confirmandoProducto && (
        <ConfirmarDialog
          titulo="¿Crear el producto en Sis2000?"
          confirmar={guardandoProducto ? 'Creando…' : 'Sí, crear producto'}
          cancelar="Volver"
          ocupado={guardandoProducto}
          onCancelar={() => setConfirmandoProducto(false)}
          onConfirmar={() => void crearProductoEnRamo()}
        >
          <p>
            Se va a crear el producto <strong>«{nuevoProducto.xdescripcion_l.trim()}»</strong> ({nuevoProducto.cproducto.trim()}) en{' '}
            {opcionesRamo.find((r) => r.cramo === ramoElegido)?.etiqueta ?? `el ramo ${ramoElegido}`}.
          </p>
          <p className="text-xs text-muted-foreground">Los productos no se borran desde el configurador.</p>
        </ConfirmarDialog>
      )}

      {tablaDlg && (
        <TablaEdadDialog
          key={`${tablaDlg.modo}-${tablaDlg.destino}-${tablaDlg.codigo}`}
          modo={tablaDlg.modo}
          codigo={tablaDlg.codigo}
          descripcion={tablaDlg.descripcion}
          onClose={() => setTablaDlg(null)}
          onCreada={(codigo) => {
            if (tablaDlg.destino === 'plan') setTablaPlan(codigo);
            else cambiarFilaPer(tablaDlg.destino, { ctablatar: codigo });
            // Recién creada: que «Así se calculará» la vuelva a leer.
            setTablasLeidas((prev) => {
              const next = { ...prev };
              delete next[codigo.toUpperCase()];
              return next;
            });
          }}
          tramosIniciales={
            entero(edadMin) != null && entero(edadMax) != null
              ? [{ desde: String(entero(edadMin)), hasta: String(entero(edadMax)), tasa: '', prima: '' }]
              : undefined
          }
        />
      )}

      {buscadorDlg && (
        <TablaEdadBuscador
          destino={buscadorDlg.etiqueta}
          valorActual={buscadorDlg.valor}
          permitirTodas={incluidas.length > 1 || buscadorDlg.destino === 'plan'}
          onClose={() => setBuscadorDlg(null)}
          onElegir={(codigo, enTodas) => {
            asignarTabla(buscadorDlg.destino, codigo, enTodas);
            setBuscadorDlg(null);
          }}
          onCrearNueva={(sugerido) => {
            const { destino, descripcion } = buscadorDlg;
            setBuscadorDlg(null);
            abrirCrearTabla(destino, descripcion, sugerido);
          }}
        />
      )}
    </AppShell>
  );
}
