import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Boxes,
  Calculator,
  Check,
  ClipboardCheck,
  Equal,
  FileText,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  Users,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
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
import { AppShell } from '@/components/layout/AppShell';
import {
  CoberturaSumaConfigFields,
  type SumaConfigValores,
} from '@/components/sis2000/CoberturaSumaConfigFields';
import { Sis2000NuevaCoberturaForm } from '@/components/sis2000/Sis2000NuevaCoberturaForm';
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
  canalesToPayloadFields,
  type CanalesSelection,
} from '@/components/sis2000/CanalesSelector';
import { ProveedoresPlanPanel } from '@/components/sis2000/ProveedoresPlanPanel';
import { CobroDiasPanel } from '@/components/sis2000/CobroDiasPanel';
import { TablaEdadDialog, type TablaEdad } from '@/components/sis2000/TablaEdadDialog';
import { TablaEdadBuscador } from '@/components/sis2000/TablaEdadBuscador';
import {
  nombreParentesco,
  ParentescosSelector,
  type Parentesco,
} from '@/components/sis2000/ParentescosSelector';
import { formatoMonto2, traducirErrorSis2000 } from '@/lib/sis2000-tramos';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

/** Frecuencias de pago que admite el plan (maplanes_frec). */
const FRECUENCIAS = [
  { ifrecuencia: 'A', xfrecuencia: 'Anual', ndias: 365 },
  { ifrecuencia: 'S', xfrecuencia: 'Semestral', ndias: 180 },
  { ifrecuencia: 'T', xfrecuencia: 'Trimestral', ndias: 90 },
  { ifrecuencia: 'M', xfrecuencia: 'Mensual', ndias: 30 },
];

/** Columnas editables de cada cobertura (se graban en maplantar, no cambian la tarifa). */
const MONTOS = [
  {
    campo: 'msumamin',
    etiqueta: 'Suma mínima',
    ayuda: 'Suma asegurada mínima de la cobertura en este plan (maplantar.msumamin).',
  },
  {
    campo: 'msumamax',
    etiqueta: 'Suma máxima',
    ayuda: 'Suma asegurada máxima de la cobertura en este plan (maplantar.msumamax). Debe ser mayor a 0.',
  },
  {
    campo: 'pprima',
    etiqueta: 'Tasa %',
    ayuda: 'Tasa en % sobre la suma asegurada (maplantar.pprima). Indica tasa o prima fija.',
  },
  {
    campo: 'mprima',
    etiqueta: 'Prima fija',
    ayuda: 'Prima fija de la cobertura (maplantar.mprima). Indica tasa o prima fija.',
  },
] as const;

type CampoMonto = (typeof MONTOS)[number]['campo'];

/** Columnas de monto en planes de personas (van al parentesco: mapltarifas_per). */
const MONTOS_PERSONAS: ReadonlyArray<{ campo: CampoMonto; etiqueta: string; ayuda: string }> = [
  {
    campo: 'msumamax',
    etiqueta: 'Suma asegurada',
    ayuda: 'Suma asegurada de la cobertura para cada parentesco del plan (msuma y msumamax). Viene de la tarifa; 0 si la suma sale de la tabla de tasas.',
  },
  {
    campo: 'mprima',
    etiqueta: 'Prima',
    ayuda: 'Prima de la cobertura por persona (mprima). Déjala en 0 si la prima sale de la tabla de tasas por edad.',
  },
];

const SEXOS = [
  { valor: 'A', etiqueta: 'Ambos' },
  { valor: 'M', etiqueta: 'Masculino' },
  { valor: 'F', etiqueta: 'Femenino' },
];

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

/** Pasos del flujo (barra superior). */
const PASOS = [
  { id: 'paso-ramo', etiqueta: 'Ramo' },
  { id: 'paso-producto', etiqueta: 'Producto' },
  { id: 'paso-tipo', etiqueta: 'Tipo de plan' },
  { id: 'paso-coberturas', etiqueta: 'Coberturas' },
  { id: 'paso-tablas', etiqueta: 'Tablas por edad' },
  { id: 'paso-datos', etiqueta: 'Datos del plan' },
  { id: 'paso-revisar', etiqueta: 'Revisar y crear' },
] as const;

function irA(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Precio de un tramo en palabras («prima 12,50» o «tasa 0,449 % × suma»). */
function precioTramo(t: { pprima?: number; mprima?: number }, suma: number, moneda: string): string {
  const prima = Number(t.mprima ?? 0);
  const tasa = Number(t.pprima ?? 0);
  if (prima > 0) return `prima fija ${moneda} ${formatoMonto2(prima)}`;
  if (tasa > 0) {
    const tasaTxt = tasa.toLocaleString('es-VE', { maximumFractionDigits: 6 });
    return suma > 0
      ? `tasa ${tasaTxt} % × suma ${formatoMonto2(suma)} = ${moneda} ${formatoMonto2((suma * tasa) / 100)}`
      : `tasa ${tasaTxt} % sobre la suma asegurada`;
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

interface PlanCreado {
  cramo: number;
  cplan: string;
  tipo: Sis2000PlanType;
  /** Frecuencia con la que se cotiza: Anual si el plan la tiene, si no la primera del plan. */
  ifrecuencia: string;
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
  return {
    ctarifa: texto(tarifa?.ctarifa),
    msumamin: aInput(detalle?.msumamin),
    msumamax: aInput(detalle?.msumamax),
    pprima: aInput(detalle?.pprima),
    mprima: aInput(detalle?.mprima),
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

export function Sis2000ComboPage() {
  const hoy = useMemo(hoyIso, []);
  /** Borrador guardado en este navegador (se lee una sola vez al abrir la pantalla). */
  const [inicio] = useState(leerBorrador);
  /** Filas del borrador que aún no se aplicaron: se usan al llegar las tarifas del mismo ramo. */
  const borradorFilas = useRef<{ cramo: number; filas: Record<string, FilaCombo>; filasPer: Record<string, FilaPersonas> } | null>(
    inicio && inicio.cramo > 0 ? { cramo: inicio.cramo, filas: inicio.filas ?? {}, filasPer: inicio.filasPer ?? {} } : null,
  );
  const [borradorRestaurado] = useState(Boolean(inicio));
  /** true al pedir «Empezar de cero»: ya no se vuelve a guardar el borrador. */
  const sinBorrador = useRef(false);
  const [ultimoGuardado, setUltimoGuardado] = useState<string | null>(inicio?.guardado ?? null);

  const [productos, setProductos] = useState<Sis2000Product[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState(true);
  const [errorProductos, setErrorProductos] = useState<string | null>(null);
  /** Producto elegido: clave cproducto|cramo (maproductos repite cada producto en SysIP y Nexus). */
  const [claveProducto, setClaveProducto] = useState(inicio?.claveProducto ?? '');
  /** Ramo elegido para filtrar el selector de producto (RAMO_TODOS = sin filtro). */
  const [ramoFiltro, setRamoFiltro] = useState(inicio?.ramoFiltro || RAMO_TODOS);
  /** Ramos de Sis2000 (maramos). Vacío si no se pudieron leer: el selector usa los ramos deducidos de los productos. */
  const [ramosSis2000, setRamosSis2000] = useState<Array<{ cramo: number; xdescripcion: string }>>([]);
  const [mostrarNuevoProducto, setMostrarNuevoProducto] = useState(false);
  const [nuevoProducto, setNuevoProducto] = useState(PRODUCTO_NUEVO);
  const [intentoProducto, setIntentoProducto] = useState(false);
  const [guardandoProducto, setGuardandoProducto] = useState(false);
  const [errorNuevoProducto, setErrorNuevoProducto] = useState<string | null>(null);
  const [avisoProducto, setAvisoProducto] = useState<string | null>(null);

  const [catalogo, setCatalogo] = useState<{ cramo: number; coberturas: CoberturaRamo[] } | null>(
    null,
  );
  const [cargandoCoberturas, setCargandoCoberturas] = useState(false);
  const [errorCoberturas, setErrorCoberturas] = useState<string | null>(null);
  const [tarifas, setTarifas] = useState<Record<string, CargaTarifas>>({});
  const [filas, setFilas] = useState<Record<string, FilaCombo>>({});
  const [mostrarInactivas, setMostrarInactivas] = useState(false);
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
  const [errorSuma, setErrorSuma] = useState<string | null>(null);

  /** Cosas (maplanes + maplantar) o personas (maplanes_per + maplcober_per, mapltarifas_per, mapledades_per). */
  const [tipoPlan, setTipoPlan] = useState<Sis2000PlanType>(inicio?.tipoPlan === 'personas' ? 'personas' : 'cosas');
  const personas = tipoPlan === 'personas';
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
  /** Quién puede vender el plan: lista de productores (por defecto 80080) o todos. */
  const [productoresSel, setProductoresSel] = useState<ProductoresSelection>(inicio?.productoresSel ?? PRODUCTORES_DEFAULT);
  /** Canales alternos (mausuplan C): solo si el servidor lo habilita (SIS2000_PLAN_CANALES). */
  const [canalesSel, setCanalesSel] = useState<CanalesSelection>(inicio?.canalesSel ?? CANALES_DEFAULT);
  const [canalesHabilitados, setCanalesHabilitados] = useState(false);

  useEffect(() => {
    void api
      .getSis2000Funciones()
      .then((f) => setCanalesHabilitados(f.canalesEnPlan === true))
      .catch(() => setCanalesHabilitados(false));
  }, []);

  const [intentoCrear, setIntentoCrear] = useState(false);
  const [creando, setCreando] = useState(false);
  const [errorCrear, setErrorCrear] = useState<string | null>(null);
  const [planCreado, setPlanCreado] = useState<PlanCreado | null>(null);
  /** Cambia solo al empezar otro plan tras uno ya creado: así los proveedores pendientes no se pierden al crear. */
  const [proveedoresKey, setProveedoresKey] = useState(0);
  const [cotizando, setCotizando] = useState(false);
  const [errorCotizar, setErrorCotizar] = useState<string | null>(null);
  const [cotizacion, setCotizacion] = useState<Sis2000NestRow[] | null>(null);

  async function cargarProductos() {
    setCargandoProductos(true);
    setErrorProductos(null);
    try {
      setProductos(await api.listSis2000Products());
    } catch (e) {
      setErrorProductos(
        e instanceof Error ? e.message : 'No se pudo cargar el catálogo de productos Sis2000',
      );
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

  const opcionesProducto = useMemo(() => agruparProductosSis2000(productos), [productos]);
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
        etiqueta: r.xdescripcion ? `${r.cramo} · ${r.xdescripcion}` : `Ramo ${r.cramo}`,
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
  const opcionProducto = useMemo(
    () => opcionesProducto.find((o) => o.clave === claveProducto) ?? null,
    [opcionesProducto, claveProducto],
  );
  const producto = opcionProducto?.producto ?? null;
  const cproducto = opcionProducto?.cproducto ?? '';
  const cramo = producto && Number(producto.cramo) > 0 ? Number(producto.cramo) : 0;
  const esPersonas = texto(producto?.xform).toLowerCase().startsWith('person');

  // Borrador en localStorage: se guarda medio segundo después del último cambio.
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
        cramo: cramo || pendiente?.cramo || 0,
        filas: pendiente ? { ...pendiente.filas, ...filas } : filas,
        filasPer: Object.keys(filasPer).length || !pendiente ? filasPer : pendiente.filasPer,
        guardado,
      });
      setUltimoGuardado(guardado);
    }, 500);
    return () => clearTimeout(t);
  }, [
    ramoFiltro, claveProducto, tipoPlan, parentescosTxt, csexo, edadMin, edadMax, tablaPlan, cplan, xplan, fdesde,
    fhasta, cmoneda, frecuencias, productoresSel, canalesSel, cramo, filas, filasPer,
  ]);

  /** Empieza un combo nuevo: borra el borrador y recarga la pantalla limpia. */
  function empezarDeCero() {
    if (!window.confirm('¿Borrar todo lo llenado y empezar un combo nuevo?')) return;
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
        setErrorCoberturas(e instanceof Error ? e.message : 'Error al cargar coberturas');
      })
      .finally(() => {
        if (gen === generacion.current) setCargandoCoberturas(false);
      });
  }, [cramo, recarga]);

  const visibles = useMemo(() => {
    if (!catalogo || catalogo.cramo !== cramo) return [];
    return mostrarInactivas ? catalogo.coberturas : catalogo.coberturas.filter((c) => !c.inactiva);
  }, [catalogo, cramo, mostrarInactivas]);

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
          const guardada = borradorFilas.current?.cramo === ramo ? borradorFilas.current.filas[c.ccobertura] : undefined;
          if (guardada && rows.some((t) => esVigente(t) && texto(t.ctarifa) === guardada.ctarifa)) {
            return { ...prev, [c.ccobertura]: { ...guardada } };
          }
          const fila = filaInicial(c.ccobertura, rows, hoy);
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
            error: e instanceof Error ? e.message : 'Error al cargar tarifas',
          },
        }));
      }
    });
  }, [catalogo, cramo, visibles, hoy]);

  const vistas = useMemo<VistaCobertura[]>(
    () =>
      visibles.map((cobertura) => {
        const carga = tarifas[cobertura.ccobertura];
        const vigentes = carga?.estado === 'ok' ? carga.tarifas.filter(esVigente) : [];
        const fila = filas[cobertura.ccobertura];
        const tarifa = vigentes.find((t) => texto(t.ctarifa) === fila?.ctarifa) ?? vigentes[0];
        const config = sumaConfig[cobertura.ccobertura.toUpperCase()];
        return {
          cobertura,
          carga,
          vigentes,
          tarifa,
          fila,
          obligatoria: esObligatoria(tarifa, cobertura.ccobertura),
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

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vistas;
    return vistas.filter((v) => JSON.stringify(v.cobertura.fila).toLowerCase().includes(q));
  }, [vistas, search]);

  const totalTarifas = Object.keys(tarifas).length;
  const tarifasListas = Object.values(tarifas).filter((t) => t.estado !== 'cargando').length;
  const cargandoTarifas = tarifasListas < totalTarifas;
  const inactivas = catalogo?.coberturas.filter((c) => c.inactiva).length ?? 0;
  const sinTarifa = vistas.filter((v) => v.carga?.estado === 'ok' && !v.vigentes.length).length;

  function cambiarFila(ccobertura: string, cambios: Partial<FilaCombo>) {
    setFilas((prev) => {
      const actual = prev[ccobertura];
      return actual ? { ...prev, [ccobertura]: { ...actual, ...cambios } } : prev;
    });
  }

  function cambiarMonto(ccobertura: string, campo: CampoMonto, valor: string) {
    setFilas((prev) => {
      const actual = prev[ccobertura];
      return actual ? { ...prev, [ccobertura]: { ...actual, [campo]: valor } } : prev;
    });
  }

  /** Otra tarifa vigente: se vuelven a tomar sumas, tasa y prima de su detalle vigente. */
  function cambiarTarifa(v: VistaCobertura, ctarifa: string) {
    const tarifa = v.vigentes.find((t) => texto(t.ctarifa) === ctarifa);
    cambiarFila(v.cobertura.ccobertura, valoresDeTarifa(tarifa, hoy));
  }

  function celdaTarifa(v: VistaCobertura) {
    const { carga, vigentes, tarifa, fila, cobertura } = v;
    if (!carga || carga.estado === 'cargando') {
      return <span className="text-muted-foreground">Cargando…</span>;
    }
    if (carga.estado === 'error') {
      return (
        <span className="text-rose-600" title={carga.error}>
          No se pudieron cargar las tarifas
        </span>
      );
    }
    if (!vigentes.length) {
      return (
        <span className="inline-flex flex-wrap items-center gap-x-2">
          <span className="font-semibold text-amber-700">Sin tarifa vigente</span>
          <Link
            to={`/sis2000/ramo/${cramo}/coberturas/${encodeURIComponent(cobertura.ccobertura)}/tarifas`}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Tarifas
          </Link>
        </span>
      );
    }
    if (vigentes.length === 1 || !fila) {
      return (
        <span>
          {texto(tarifa?.ctarifa)} · {tarifa ? formatTarifaDescripcion(tarifa) : '—'}
        </span>
      );
    }
    return (
      <Select value={fila.ctarifa} onValueChange={(valor) => cambiarTarifa(v, valor)}>
        <SelectTrigger
          aria-label={`Tarifa de la cobertura ${cobertura.ccobertura}`}
          className="h-8 min-h-0 w-44 rounded-lg px-2 py-1 text-xs"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {vigentes.map((t) => (
            <SelectItem key={texto(t.ctarifa)} value={texto(t.ctarifa)}>
              {texto(t.ctarifa)} · {formatTarifaDescripcion(t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  /** Monedas del catálogo; si la sugerida no está en la lista, se agrega para que el select la muestre. */
  const opcionesDeMoneda = useMemo(() => {
    const actual = cmoneda.trim();
    return actual && !monedas.some((m) => m.codigo === actual)
      ? [{ codigo: actual, nombre: '' }, ...monedas]
      : monedas;
  }, [monedas, cmoneda]);

  function alternarFrecuencia(ifrecuencia: string, marcada: boolean) {
    setFrecuencias((prev) => {
      const sin = prev.filter((f) => f !== ifrecuencia);
      return marcada ? [...sin, ifrecuencia] : sin;
    });
  }

  /** Referencia con las sumas máximas: tasa × suma ÷ 100 si hay tasa, si no la prima fija. */
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
      const suma = numero(v.fila.msumamax);
      const tasa = numero(v.fila.pprima);
      sumaMaxima = Math.max(sumaMaxima, suma);
      prima += tasa > 0 ? (suma * tasa) / 100 : numero(v.fila.mprima);
    }
    return { sumaMaxima, prima };
  }, [incluidas, personas]);

  const filaPer = (ccobertura: string) => filasPer[ccobertura] ?? FILA_PERSONAS;

  function cambiarFilaPer(ccobertura: string, cambios: Partial<FilaPersonas>) {
    setFilasPer((prev) => ({ ...prev, [ccobertura]: { ...(prev[ccobertura] ?? FILA_PERSONAS), ...cambios } }));
  }

  /** Tabla de tasas de la cobertura: la suya o, si está vacía, la del plan. */
  const tablaDe = (ccobertura: string) => filaPer(ccobertura).ctablatar.trim() || tablaPlan.trim();

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
        : `Cobertura ${destino}${descripcionCobertura ? ` · ${descripcionCobertura}` : ''}`;
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

  function cambiarTipoPlan(valor: string) {
    setTipoPlan(valor === 'personas' ? 'personas' : 'cosas');
    setEditandoSuma(null);
    setIntentoCrear(false);
    limpiarResultado();
  }

  /** CreatePlanDto (cosas o personas) con las coberturas incluidas, listo para POST /core/sis2000/plans. */
  function armarPayload(): Record<string, unknown> {
    const payload = defaultPlanPayload({
      type: tipoPlan,
      cramo,
      cproducto,
      cplan: cplan.trim(),
      ...productoresToPayloadFields(productoresSel),
    });
    payload.xplan = xplan.trim();
    payload.fdesde = fdesde;
    payload.fhasta = fhasta;
    payload.cmoneda = cmoneda.trim();
    payload.all_productor = productoresSel.todos;
    if (canalesHabilitados) Object.assign(payload, canalesToPayloadFields(canalesSel));
    payload.frecuencias = FRECUENCIAS.filter((f) => frecuencias.includes(f.ifrecuencia)).map(
      (f) => ({ ...f }),
    );
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
      return normalizePlanPayloadForApi({ ...payload }, 'create');
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
            mprima: numero(v.fila.mprima),
            pprima: numero(v.fila.pprima),
          },
    );
    return normalizePlanPayloadForApi({ ...payload }, 'create');
  }

  /** Lo que nest-api rechazaría, dicho por cobertura; validatePlanPayload queda como red final. */
  function validarCombo(): string[] {
    const errores: string[] = [];
    if (!producto) errores.push('Elige el producto de Sis2000.');
    const codigo = cplan.trim();
    if (!codigo) errores.push('Escribe el código del plan.');
    else if (codigo.length > 6) errores.push('El código del plan admite máx. 6 caracteres.');
    if (!xplan.trim()) errores.push('Escribe el nombre del plan.');
    else if (xplan.trim().length > 60) errores.push('El nombre del plan admite máx. 60 caracteres.');
    if (!fdesde || !fhasta) errores.push('Indica la vigencia del plan (desde y hasta).');
    else if (fdesde > fhasta) errores.push('La vigencia «desde» es posterior a «hasta».');
    if (!cmoneda.trim()) errores.push('Indica la moneda del plan.');
    if (!frecuencias.length) errores.push('Marca al menos una frecuencia de pago.');
    const errorProductores = validarProductores(productoresSel);
    if (errorProductores) errores.push(errorProductores);

    if (!incluidas.length) errores.push('Incluye al menos una cobertura en el combo.');
    const nombre = (v: VistaCobertura) =>
      `Cobertura ${v.cobertura.ccobertura}${v.cobertura.descripcion ? ` (${v.cobertura.descripcion})` : ''}`;
    if (personas) {
      const min = entero(edadMin);
      const max = entero(edadMax);
      if (!cparens) errores.push('Parentescos: marca al menos uno (por ejemplo, Titular).');
      else if (new Set(cparens).size !== cparens.length) errores.push('Parentescos: hay códigos repetidos.');
      if (min == null || max == null) errores.push('Indica la edad mínima y máxima del plan (enteros).');
      else if (min > max) errores.push('La edad mínima es mayor que la máxima.');
      for (const v of incluidas) {
        const n = nombre(v);
        const tabla = tablaDe(v.cobertura.ccobertura);
        if (!v.fila.ctarifa) errores.push(`${n}: falta la tarifa.`);
        if (!tabla) errores.push(`${n}: falta la tabla de tasas por edad (la del plan o la de la cobertura).`);
        else if (tabla.length > 10) errores.push(`${n}: la tabla de tasas admite máx. 10 caracteres.`);
        if (numero(v.fila.msumamax) < 0 || numero(v.fila.mprima) < 0) errores.push(`${n}: no admite montos negativos.`);
      }
      if (!errores.length) errores.push(...validatePlanPayload(armarPayload()));
      return errores;
    }
    for (const v of incluidas) {
      const n = nombre(v);
      const min = numero(v.fila.msumamin);
      const max = numero(v.fila.msumamax);
      const tasa = numero(v.fila.pprima);
      const prima = numero(v.fila.mprima);
      if (!v.fila.ctarifa) errores.push(`${n}: falta la tarifa.`);
      if (v.calculada) continue; // suma, tasa y prima llegan al emitir
      if (!(max > 0)) errores.push(`${n}: la suma máxima debe ser mayor a 0.`);
      if (min > max) errores.push(`${n}: la suma mínima es mayor que la máxima.`);
      if (min < 0 || tasa < 0 || prima < 0) errores.push(`${n}: no admite montos negativos.`);
      if (!(tasa > 0) && !(prima > 0)) errores.push(`${n}: indica una tasa o una prima fija mayor a 0.`);
    }
    const basica = incluidas.find((v) => v.cobertura.ccobertura === '1');
    if (basica) {
      const maxBasica = numero(basica.fila.msumamax);
      for (const v of incluidas) {
        if (v === basica || v.obligatoria || v.calculada) continue;
        const max = numero(v.fila.msumamax);
        if (max > maxBasica) {
          errores.push(
            `${nombre(v)}: es opcional y su suma máxima (${formatoMonto(max)}) supera la de la básica (cobertura 1: ${formatoMonto(maxBasica)}).`,
          );
        }
      }
    }

    if (!errores.length) errores.push(...validatePlanPayload(armarPayload()));
    return errores;
  }

  const errores = validarCombo();

  function limpiarResultado() {
    setErrorCrear(null);
    if (planCreado) setProveedoresKey((k) => k + 1);
    setPlanCreado(null);
    setCotizacion(null);
    setErrorCotizar(null);
  }

  async function crear() {
    setIntentoCrear(true);
    limpiarResultado();
    if (errores.length) return;
    setCreando(true);
    try {
      const payload = armarPayload();
      await api.createSis2000MasterPlan(payload);
      const ifrecuencia =
        FRECUENCIAS.find((f) => frecuencias.includes(f.ifrecuencia))?.ifrecuencia ?? 'A';
      setPlanCreado({ cramo, cplan: String(payload.cplan), tipo: tipoPlan, ifrecuencia });
      // Creado: el borrador ya no hace falta (si se recarga, no debe proponer el mismo plan otra vez).
      borrarBorrador();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setErrorCrear(
          `Ya existe un plan con ese código en el ramo ${cramo} (${cplan.trim()}). Usa otro código de plan.`,
        );
      } else {
        setErrorCrear(
          `No se pudo crear el plan. ${traducirErrorSis2000(e instanceof Error ? e.message : 'Error al crear el plan en Sis2000')} Lo que llenaste sigue guardado en esta pantalla.`,
        );
      }
    } finally {
      setCreando(false);
    }
  }

  /** Cotiza el plan recién creado con spCalculoRiesgoGeneral (solo lectura: no emite). */
  async function cotizar() {
    if (!planCreado) return;
    setCotizando(true);
    setErrorCotizar(null);
    setCotizacion(null);
    try {
      const rows = await api.cotizarSis2000Plan(
        planCreado.cramo,
        planCreado.cplan,
        planCreado.ifrecuencia,
      );
      if (!rows.length) {
        setErrorCotizar(
          'La cotización no devolvió coberturas: revisa que el plan tenga suma y tasa o prima.',
        );
        return;
      }
      setCotizacion(rows);
    } catch (e) {
      setErrorCotizar(e instanceof Error ? e.message : 'Error al cotizar el plan');
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

  /** Crea el producto en el ramo elegido (sp_CrearProducto), recarga el catálogo y lo deja elegido. */
  async function crearProductoEnRamo() {
    setIntentoProducto(true);
    setErrorNuevoProducto(null);
    setAvisoProducto(null);
    if (!ramoElegido || erroresProducto.cproducto || erroresProducto.xdescripcion_l) return;
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
        setAvisoProducto(`${mensaje} Producto ${codigo} elegido: sigue con el tipo de plan y las coberturas.`);
      } else {
        const provisional = {
          cproducto: codigo,
          cramo: ramoElegido,
          u_version: null,
          xdescripcion_l: datosNuevo.xdescripcion_l.trim(),
          xdescripcion_c: datosNuevo.xdescripcion_c.trim() || null,
          xabreviatura: datosNuevo.xabreviatura.trim(),
          iproductor: datosNuevo.iproductor,
          icanal: datosNuevo.icanal,
          xform: '',
          cprog: null,
          ifuente: null,
          bok: null,
          cerror: null,
          fingreso: null,
          cusuario: null,
        } as unknown as Sis2000Product;
        setProductos((prev) => [...(lista ?? prev), provisional]);
        elegirProducto(`${codigo}|${ramoElegido}`);
        setAvisoProducto(
          `${mensaje} Producto ${codigo} elegido (todavía no aparece en el catálogo de Sis2000, pero ya puedes armar el plan).`,
        );
      }
    } catch (e) {
      setErrorNuevoProducto(e instanceof Error ? e.message : 'No se pudo crear el producto en Sis2000');
    } finally {
      setGuardandoProducto(false);
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
      setErrorCoberturas(e instanceof Error ? e.message : 'Error al recargar coberturas');
    }
  }

  function coberturaCreada(ccobertura: string, ctarifa: string, config: CoberturaSumaConfig | null) {
    porIncluir.current.add(ccobertura);
    if (config) setSumaConfig((prev) => ({ ...prev, [ccobertura.toUpperCase()]: config }));
    setMostrarNuevaCobertura(false);
    setSearch('');
    setAvisoCobertura(
      `Cobertura ${ccobertura} (tarifa ${ctarifa}) creada en el ramo ${cramo}. Ya aparece en la tabla, marcada para este combo.`,
    );
    limpiarResultado();
    void refrescarCoberturas();
  }

  function cerrarNuevaCobertura() {
    setMostrarNuevaCobertura(false);
    // Si la cobertura quedó grabada sin tarifa, que se vea en la tabla («sin tarifa vigente»).
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
      setErrorSuma(e instanceof Error ? e.message : 'No se pudo guardar la suma de la cobertura');
    } finally {
      setGuardandoSuma(false);
    }
  }

  function recargar() {
    void cargarProductos();
    setRecarga((n) => n + 1);
  }

  const ocupado = cargandoProductos || cargandoCoberturas;
  const columnasMonto = personas ? MONTOS_PERSONAS : MONTOS;

  // ── Estado de cada paso (barra superior y revisión final) ──
  const datosPlanListos =
    Boolean(cplan.trim()) &&
    cplan.trim().length <= 6 &&
    Boolean(xplan.trim()) &&
    Boolean(fdesde && fhasta && fdesde <= fhasta) &&
    Boolean(cmoneda.trim()) &&
    frecuencias.length > 0 &&
    !validarProductores(productoresSel);
  const tablasListas =
    personas &&
    incluidas.length > 0 &&
    Boolean(cparens) &&
    incluidas.every((v) => Boolean(tablaDe(v.cobertura.ccobertura)));
  const estadoPaso: Record<(typeof PASOS)[number]['id'], 'hecho' | 'pendiente' | 'no-aplica'> = {
    'paso-ramo': cramo > 0 || ramoFiltro !== RAMO_TODOS ? 'hecho' : 'pendiente',
    'paso-producto': producto ? 'hecho' : 'pendiente',
    'paso-tipo': producto ? 'hecho' : 'pendiente',
    'paso-coberturas': incluidas.length ? 'hecho' : 'pendiente',
    'paso-tablas': !personas ? 'no-aplica' : tablasListas ? 'hecho' : 'pendiente',
    'paso-datos': datosPlanListos ? 'hecho' : 'pendiente',
    'paso-revisar': planCreado ? 'hecho' : 'pendiente',
  };
  const nombreParen = (c: number) => nombreParentesco(parentescosCat.find((p) => p.cparen === c), c);
  /** Mensajes del plan de personas que no bloquean pero conviene revisar antes de crear. */
  const avisosPersonas: string[] = [];
  if (personas) {
    tablasDelCombo.forEach((c) => {
      const t = tablasLeidas[c];
      if (t === 'error') avisosPersonas.push(`No se encontró la tabla ${c} en Sis2000: elígela con «Elegir» o créala.`);
      else if (t && t !== 'cargando' && !(t.tramos ?? []).length) avisosPersonas.push(`La tabla ${c} no tiene tramos de edad: el plan no podrá cotizar.`);
      else if (t && t !== 'cargando') {
        const min = entero(edadMin);
        const max = entero(edadMax);
        const cubre = (e: number) => (t.tramos ?? []).some((x) => e >= x.nedad_min && e <= x.nedad_max);
        if (min != null && max != null && (!cubre(min) || !cubre(max))) {
          avisosPersonas.push(`La tabla ${c} no cubre todas las edades del plan (${min} a ${max} años): a quien quede fuera no se le podrá calcular la prima.`);
        }
      }
    });
  }

  return (
    <AppShell title="Combos de coberturas">
      <nav
        aria-label="Pasos para crear el plan"
        className="sticky top-0 z-30 -mx-1 mb-4 overflow-x-auto rounded-xl border border-border/60 bg-background/95 px-2 py-2 shadow-sm backdrop-blur"
      >
        <ol className="flex min-w-max items-center gap-1">
          {PASOS.map((p, i) => {
            const estado = estadoPaso[p.id];
            return (
              <li key={p.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => irA(p.id === 'paso-tablas' && !personas ? 'paso-coberturas' : p.id)}
                  disabled={estado === 'no-aplica'}
                  title={estado === 'no-aplica' ? 'Solo para planes de personas' : undefined}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-colors',
                    estado === 'hecho' && 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
                    estado === 'pendiente' && 'text-foreground hover:bg-muted',
                    estado === 'no-aplica' && 'cursor-not-allowed text-muted-foreground line-through opacity-60',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                      estado === 'hecho' ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {estado === 'hecho' ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  {p.etiqueta}
                </button>
                {i < PASOS.length - 1 && <span className="text-muted-foreground/50">›</span>}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/sis2000"
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Catálogo Sis2000
          </Link>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <Boxes className="h-5 w-5 text-primary" />
            Combos de coberturas
          </h1>
          <p className="text-xs text-muted-foreground">
            nest-api POST /api/v1/configurador/planes → spMantPlanes (
            {personas
              ? 'maplanes_per, maplcober_per, mapltarifas_per, mapledades_per'
              : 'maplanes, maplantar, maplanes_frec, mausuplan'}
            )
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ultimoGuardado && (
            <span className="text-[11px] text-muted-foreground" title="Lo llenado se guarda en este navegador y se recupera si recargas la página o falla la creación.">
              Borrador guardado {ultimoGuardado}
            </span>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={empezarDeCero}>
            Empezar de cero
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={recargar} disabled={ocupado}>
            <RefreshCw className={cn('h-3.5 w-3.5', ocupado && 'animate-spin')} />
            Recargar
          </Button>
        </div>
      </div>

      {borradorRestaurado && !planCreado && (
        <Alert variant="info" className="mb-3">
          Recuperamos lo que habías llenado antes en este navegador. Revisa los datos; si prefieres empezar otro combo, usa
          «Empezar de cero».
        </Alert>
      )}

      <p className="mb-1 max-w-4xl text-sm text-muted-foreground">
        Sigue los pasos de arriba: elige el ramo y el producto, el tipo de plan, marca las coberturas que forman el combo
        y ajusta sus montos. Al final revisa el resumen y crea el plan: el configurador lo da de alta en Sis2000 con
        exactamente esas coberturas y la emisión usa ese plan.
      </p>
      <p className="mb-4 max-w-4xl text-xs text-amber-800 dark:text-amber-200">
        {personas
          ? 'Plan de personas: cada cobertura lleva parentescos, rango de edad y una tabla de tasas por edad que ya debe existir en Sis2000 (mapltabedad, con tramos). La tasa y la prima fija por cobertura de cosas no aplican.'
          : 'Plan de cosas: suma asegurada con tasa o prima fija por cobertura. Para un plan de personas (parentescos, edades y tabla de tasas por edad) cambia «Tipo de plan» a Personas.'}
      </p>

      <div className="space-y-5">
        <div id="paso-ramo" className="scroll-mt-20">
        <SectionPanel
          title="1–3 · Ramo, producto y tipo de plan"
          description="El plan se crea en el ramo del producto; de ese ramo salen las coberturas y tarifas."
          icon={Package}
        >
          <div id="paso-producto" className="grid scroll-mt-20 gap-4 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto] sm:items-end">
            <FormField
              label="Ramo (cramo)"
              tooltip="Acota la lista de productos a un ramo de Sis2000. «Todos los ramos» muestra todos los productos."
            >
              {cargandoProductos && !productos.length ? (
                <div className="h-[42px] animate-pulse rounded-xl bg-muted/60" />
              ) : (
                <Select value={ramoFiltro} onValueChange={elegirRamo}>
                  <SelectTrigger aria-label="Ramo Sis2000">
                    <SelectValue placeholder="Todos los ramos" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    <SelectItem value={RAMO_TODOS}>Todos los ramos</SelectItem>
                    {opcionesRamo.map((r) => (
                      <SelectItem key={r.cramo} value={String(r.cramo)}>
                        {r.etiqueta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField
              label="Producto (cproducto)"
              tooltip="Producto de Sis2000 al que pertenece el plan. Las coberturas y tarifas del combo salen de su ramo."
            >
              {cargandoProductos && !productos.length ? (
                <div className="h-[42px] animate-pulse rounded-xl bg-muted/60" />
              ) : (
                <Select value={claveProducto} onValueChange={elegirProducto}>
                  <SelectTrigger aria-label="Producto Sis2000">
                    <SelectValue placeholder="Elige un producto…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {opcionesProductoFiltradas.map((o) => (
                      <SelectItem key={o.clave} value={o.clave} disabled={!o.cramo}>
                        {o.cproducto} · {texto(o.producto.xdescripcion_l) || 'Sin nombre'} ·{' '}
                        {o.cramo ? `ramo ${o.cramo}` : 'sin ramo'}
                        {o.tieneNexus ? ' · también en Nexus' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            {cramo > 0 && (
              <div className="flex flex-wrap items-center gap-3 pb-2">
                <Badge>Ramo {cramo}</Badge>
                {opcionProducto && opcionProducto.formularios.length > 1 && (
                  <span
                    className="text-xs text-muted-foreground"
                    title="maproductos tiene una fila por formulario (SysIP y Nexus); el plan es el mismo para ambas."
                  >
                    Formularios: {opcionProducto.formularios.join(' · ')}
                  </span>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAvisoCobertura(null);
                    setMostrarNuevaCobertura((v) => !v);
                  }}
                  disabled={!catalogo || catalogo.cramo !== cramo}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nueva cobertura en este ramo
                </Button>
              </div>
            )}
          </div>
          {ramoElegido > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setAvisoProducto(null);
                  if (mostrarNuevoProducto) cerrarNuevoProducto();
                  else setMostrarNuevoProducto(true);
                }}
                disabled={guardandoProducto}
              >
                <Plus className="h-3.5 w-3.5" />
                Crear producto en este ramo
              </Button>
              {!cargandoProductos && !errorProductos && !opcionesProductoFiltradas.length && (
                <span className="text-xs text-muted-foreground">
                  Este ramo no tiene productos en Sis2000
                </span>
              )}
            </div>
          )}
          {ramoElegido > 0 && mostrarNuevoProducto && (
            <div className="mt-3 rounded-xl border border-border/60 bg-card p-4">
              <p className="mb-3 text-sm font-semibold">Nuevo producto en el ramo {ramoElegido}</p>
              <FormGrid>
                <FormField
                  label="Código (cproducto)"
                  htmlFor="nuevo-prod-codigo"
                  hint="Sin espacios. Máx. 6 caracteres (lo que admite el plan)."
                  error={intentoProducto ? erroresProducto.cproducto : undefined}
                >
                  <Input
                    id="nuevo-prod-codigo"
                    maxLength={6}
                    value={nuevoProducto.cproducto}
                    onChange={(e) =>
                      setNuevoProducto((p) => ({ ...p, cproducto: e.target.value.replace(/\s/g, '') }))
                    }
                  />
                </FormField>
                <FormField
                  label="Nombre"
                  htmlFor="nuevo-prod-nombre"
                  hint="Máx. 60 caracteres."
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
                  label="Nombre corto"
                  htmlFor="nuevo-prod-corto"
                  hint="Opcional. Máx. 15 caracteres; vacío = inicio del nombre."
                >
                  <Input
                    id="nuevo-prod-corto"
                    maxLength={15}
                    value={nuevoProducto.xdescripcion_c}
                    onChange={(e) => setNuevoProducto((p) => ({ ...p, xdescripcion_c: e.target.value }))}
                  />
                </FormField>
                <FormField label="Abreviatura" htmlFor="nuevo-prod-abrev" hint="Opcional. Máx. 5 caracteres.">
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
                  Lo venden productores
                </label>
                <label className={ETIQUETA_OPCION}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={nuevoProducto.icanal}
                    onChange={(e) => setNuevoProducto((p) => ({ ...p, icanal: e.target.checked }))}
                  />
                  Lo venden canales
                </label>
              </div>
              {errorNuevoProducto && (
                <Alert variant="error" className="mt-3">
                  {errorNuevoProducto}
                </Alert>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" onClick={() => void crearProductoEnRamo()} disabled={guardandoProducto}>
                  {guardandoProducto ? 'Creando…' : 'Guardar producto'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={cerrarNuevoProducto}
                  disabled={guardandoProducto}
                >
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
          {avisoCobertura && (
            <Alert variant="success" className="mt-3">
              {avisoCobertura}
            </Alert>
          )}
          {errorProductos && (
            <Alert variant="error" className="mt-3">
              {errorProductos}
            </Alert>
          )}
          {!cproducto && !errorProductos && (
            <p className="mt-3 text-xs text-muted-foreground">
              Elige un producto para ver las coberturas de su ramo.
            </p>
          )}
          <div id="paso-tipo" className="mt-4 scroll-mt-20 border-t border-border/50 pt-4">
            <p className="mb-2 text-sm font-semibold">Tipo de plan</p>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Tipo de plan">
              {(
                [
                  {
                    valor: 'cosas',
                    titulo: 'Cosas (patrimonial)',
                    texto: 'Vehículos, hogar, ganado… Suma asegurada con tasa % o prima fija por cobertura.',
                  },
                  {
                    valor: 'personas',
                    titulo: 'Personas',
                    texto: 'Vida, salud, funerario, viajero… Parentescos, edades y tabla de precios por edad.',
                  },
                  {
                    valor: 'automovil',
                    titulo: 'Automóvil',
                    texto: 'Próximamente: por ahora usa «Cosas» para planes de vehículos.',
                  },
                ] as const
              ).map((o) => {
                const proximamente = o.valor === 'automovil';
                const elegido = tipoPlan === o.valor;
                return (
                  <button
                    key={o.valor}
                    type="button"
                    role="radio"
                    aria-checked={elegido}
                    disabled={proximamente}
                    onClick={() => cambiarTipoPlan(o.valor)}
                    className={cn(
                      'rounded-xl border p-3 text-left text-xs transition-colors',
                      elegido ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300' : 'border-border/60 bg-card hover:bg-muted/40',
                      proximamente && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {o.titulo}
                      {proximamente && (
                        <Badge variant="draft" className="px-2 py-0 text-[10px]">
                          Próximamente
                        </Badge>
                      )}
                      {o.valor === 'personas' && esPersonas && !elegido && (
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
          </div>
          {esPersonas && !personas && (
            <Alert variant="warning" className="mt-3">
              Este producto usa el formulario de personas y el tipo de plan elegido es Cosas. Si el
              plan lleva parentescos y tabla de tasas por edad, cambia «Tipo de plan» a Personas.
              <div className="mt-2">
                <Button type="button" size="sm" variant="outline" onClick={() => cambiarTipoPlan('personas')}>
                  Cambiar a Personas
                </Button>
              </div>
            </Alert>
          )}
        </SectionPanel>
        </div>

        {cramo > 0 && mostrarNuevaCobertura && catalogo && catalogo.cramo === cramo && (
          <SectionPanel
            title={`Nueva cobertura en el ramo ${cramo}`}
            description="nest-api POST /api/v1/configurador/coberturas y /tarifas → macoberturas, matarifa y matarifa_d. Al crearla queda marcada en este combo."
            icon={Plus}
          >
            <Sis2000NuevaCoberturaForm
              key={cramo}
              cramo={cramo}
              existentes={catalogo.coberturas.map((c) => c.fila)}
              monedaSugerida={cmoneda || '$'}
              onCreada={(c) => coberturaCreada(c.ccobertura, c.ctarifa, c.sumaConfig)}
              onCancelar={cerrarNuevaCobertura}
            />
          </SectionPanel>
        )}

        <div id="paso-coberturas" className="scroll-mt-20">
        {!cramo && (
          <SectionPanel title="4 · Coberturas" description="Elige primero el ramo y el producto." icon={Shield}>
            <p className="text-xs text-muted-foreground">Las coberturas aparecen aquí en cuanto eliges un producto.</p>
          </SectionPanel>
        )}
        {cramo > 0 && (
          <SectionPanel
            title={`4 · Coberturas del ramo ${cramo}`}
            description={
              personas
                ? 'Marca las que forman el combo. Suma y prima vienen del detalle vigente de la tarifa (matarifa_d); en el plan se graban por parentesco (mapltarifas_per) junto con la tabla de tasas por edad.'
                : 'Marca las que forman el combo. Sumas, tasa y prima fija vienen del detalle vigente de la tarifa (matarifa_d); si los cambias, solo aplican a este plan (maplantar).'
            }
            icon={Shield}
          >
            <p className="mb-3 text-xs text-muted-foreground">
              Se muestran todas las coberturas del ramo {cramo}
              {producto ? ` (las comparten todos sus productos, no solo ${cproducto})` : ''}. Marca solo las que lleva
              este plan; al cambiar de producto o de ramo la selección empieza de nuevo.
            </p>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="w-full max-w-md">
                <Input
                  placeholder="Buscar cobertura…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <label className={ETIQUETA_OPCION}>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={mostrarInactivas}
                  onChange={(e) => setMostrarInactivas(e.target.checked)}
                />
                Mostrar inactivas{inactivas ? ` (${inactivas})` : ''}
              </label>
              {!personas && incluidas.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={sumaCerradaEnTodas}
                  title="Suma asegurada cerrada: la mínima queda igual a la máxima en todas las coberturas marcadas."
                >
                  <Equal className="h-3.5 w-3.5" />
                  Suma cerrada en todas (mín = máx)
                </Button>
              )}
              {personas && incluidas.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => abrirBuscadorTabla('plan')}
                  title="Elige una tabla existente y úsala en todas las coberturas marcadas."
                >
                  <Search className="h-3.5 w-3.5" />
                  Misma tabla de tasas para todas
                </Button>
              )}
            </div>

            {cargandoTarifas && (
              <div className="mb-3 max-w-md">
                <p className="mb-1 text-xs text-muted-foreground">
                  Cargando tarifas: {tarifasListas} de {totalTarifas}…
                </p>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${totalTarifas ? (tarifasListas / totalTarifas) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            {errorCoberturas && <Alert variant="error">{errorCoberturas}</Alert>}
            {cargandoCoberturas && <div className="h-48 animate-pulse rounded-2xl bg-muted/60" />}

            {!cargandoCoberturas && !errorCoberturas && catalogo && vistas.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                El ramo {cramo} no tiene coberturas{mostrarInactivas ? '' : ' activas'}. Créala con
                «Nueva cobertura en este ramo».
              </p>
            )}

            {!cargandoCoberturas && !errorCoberturas && vistas.length > 0 && (
              <div className="tabla-cabecera-fija rounded-xl border border-border/60">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="border-b border-border/50 bg-muted/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Incluir</th>
                      <th className="px-3 py-2">Código</th>
                      <th className="px-3 py-2">Cobertura</th>
                      <th className="px-3 py-2">Tarifa</th>
                      <th className="px-3 py-2">
                        <span className="inline-flex items-center gap-1">
                          Obligatoria
                          <InfoTip
                            text={
                              personas
                                ? 'En planes de personas se guarda por plan (maplcober_per): marca si la cobertura es obligatoria al emitir.'
                                : 'Solo lectura. En planes de cosas no se guarda por plan: sale de la tarifa (matarifa.bobligatoria). La cobertura 1 es la básica. Las obligatorias entran marcadas.'
                            }
                          />
                        </span>
                      </th>
                      {columnasMonto.map((m) => (
                        <th key={m.campo} className="px-3 py-2 text-right">
                          <span className="inline-flex items-center gap-1">
                            {m.etiqueta}
                            <InfoTip text={m.ayuda} />
                          </span>
                        </th>
                      ))}
                      {personas && (
                        <th className="px-3 py-2">
                          <span className="inline-flex items-center gap-1">
                            Tabla de tasas
                            <InfoTip text={'Código de la tabla de precios por edad (mapltabedad_d). Créala con "Crear tabla" o usa una existente. Vacía = la tabla del plan.'} />
                          </span>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map((v) => {
                      const { cobertura: c, fila } = v;
                      const habilitada = Boolean(fila && v.tarifa);
                      const incluida = Boolean(habilitada && fila?.incluir);
                      return (
                        <tr
                          key={c.ccobertura}
                          className={cn(
                            'border-b border-border/30',
                            incluida && 'bg-indigo-50/60',
                            !habilitada && 'text-muted-foreground',
                          )}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-primary"
                              aria-label={`Incluir cobertura ${c.ccobertura}`}
                              checked={incluida}
                              disabled={!habilitada}
                              onChange={(e) => cambiarFila(c.ccobertura, { incluir: e.target.checked })}
                            />
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{c.ccobertura}</td>
                          <td className="px-3 py-2 text-xs">
                            {c.descripcion || '—'}
                            {c.inactiva && (
                              <Badge variant="draft" className="ml-2 px-2 py-0 text-[10px]">
                                Inactiva
                              </Badge>
                            )}
                            {v.calculada && !personas && (
                              <Badge variant="actuarial" className="ml-2 px-2 py-0 text-[10px]">
                                Suma calculada al emitir
                              </Badge>
                            )}
                            {!personas && (
                            <button
                              type="button"
                              className="ml-2 inline-flex items-center align-middle text-muted-foreground hover:text-foreground"
                              title="Suma asegurada: fija o calculada al emitir"
                              aria-label={`Editar suma asegurada de la cobertura ${c.ccobertura}`}
                              onClick={() => abrirEditorSuma(v)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs">{celdaTarifa(v)}</td>
                          <td className="px-3 py-2 text-xs">
                            {personas ? (
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-primary"
                                aria-label={`Cobertura ${c.ccobertura} obligatoria`}
                                checked={filaPer(c.ccobertura).obligatoria}
                                disabled={!habilitada}
                                onChange={(e) => cambiarFilaPer(c.ccobertura, { obligatoria: e.target.checked })}
                              />
                            ) : v.obligatoria ? (
                              <Badge variant="submitted">Obligatoria</Badge>
                            ) : (
                              <Badge>Opcional</Badge>
                            )}
                          </td>
                          {v.calculada && !personas ? (
                            <td colSpan={MONTOS.length} className="px-3 py-2 text-xs font-medium text-amber-800">
                              {textoSumaCalculada(v.sumaConfig)}
                              <span className="ml-1 font-normal text-muted-foreground">
                                · unidades × valor por unidad; en el plan se graba en 0
                              </span>
                            </td>
                          ) : (
                          columnasMonto.map((m) => (
                            <td key={m.campo} className="px-2 py-2 text-right">
                              {fila && habilitada ? (
                                <div className="flex items-center justify-end gap-1">
                                  {m.campo === 'msumamin' && !personas && (
                                    <button
                                      type="button"
                                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                                      title="Suma cerrada: igualar la mínima a la máxima"
                                      aria-label={`Igualar suma mínima a la máxima · cobertura ${c.ccobertura}`}
                                      disabled={!fila.msumamax || fila.msumamin === fila.msumamax}
                                      onClick={() => igualarSuma(c.ccobertura)}
                                    >
                                      <Equal className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  <Input
                                    type="number"
                                    inputMode="decimal"
                                    min={0}
                                    step="any"
                                    aria-label={`${m.etiqueta} · cobertura ${c.ccobertura}`}
                                    value={fila[m.campo]}
                                    onChange={(e) => cambiarMonto(c.ccobertura, m.campo, e.target.value)}
                                    className={cn(
                                      'h-8 w-28 rounded-lg px-2 py-1 text-right text-xs',
                                      intentoCrear &&
                                        incluida &&
                                        !personas &&
                                        m.campo === 'msumamin' &&
                                        numero(fila.msumamin) > numero(fila.msumamax) &&
                                        'border-rose-400 ring-1 ring-rose-300',
                                    )}
                                  />
                                </div>
                              ) : (
                                <span className="text-xs">—</span>
                              )}
                            </td>
                          ))
                          )}
                          {personas && (
                            <td className="px-2 py-2">
                              {fila && habilitada ? (
                                <div className="flex items-center gap-1.5">
                                  <Input
                                    aria-label={`Tabla de tasas · cobertura ${c.ccobertura}`}
                                    value={filaPer(c.ccobertura).ctablatar}
                                    maxLength={10}
                                    placeholder={tablaPlan.trim() || 'Tabla'}
                                    onChange={(e) => cambiarFilaPer(c.ccobertura, { ctablatar: e.target.value })}
                                    className="h-8 w-28 rounded-lg px-2 py-1 text-xs"
                                  />
                                  <button
                                    type="button"
                                    className="whitespace-nowrap text-xs font-bold text-indigo-600 hover:underline"
                                    title="Buscar una tabla que ya exista en Sis2000"
                                    onClick={() => abrirBuscadorTabla(c.ccobertura, c.descripcion)}
                                  >
                                    Elegir
                                  </button>
                                  <button
                                    type="button"
                                    className="whitespace-nowrap text-xs font-bold text-indigo-600 hover:underline"
                                    onClick={() => abrirCrearTabla(c.ccobertura, c.descripcion)}
                                  >
                                    Crear tabla
                                  </button>
                                  <button
                                    type="button"
                                    className="text-xs font-bold text-slate-500 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                                    disabled={!tablaDe(c.ccobertura)}
                                    onClick={() => abrirVerTabla(tablaDe(c.ccobertura))}
                                  >
                                    Ver
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {filtradas.length === 0 && (
                      <tr>
                        <td colSpan={5 + columnasMonto.length + (personas ? 1 : 0)} className="px-3 py-6 text-center text-xs text-muted-foreground">
                          Ninguna cobertura coincide con la búsqueda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  {filtradas.length} de {vistas.length} cobertura{vistas.length === 1 ? '' : 's'} ·{' '}
                  {incluidas.length} incluida{incluidas.length === 1 ? '' : 's'}
                  {sinTarifa ? ` · ${sinTarifa} sin tarifa vigente` : ''}
                </p>
              </div>
            )}

            {editandoSuma && !personas && (
              <div className="mt-4 space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Suma asegurada · cobertura {editandoSuma}
                </p>
                <p className="text-xs text-muted-foreground">
                  Se guarda en el configurador (no en Sis2000). Aplica a esta cobertura en cualquier plan del ramo.
                </p>
                {errorSuma && <Alert variant="error">{errorSuma}</Alert>}
                <CoberturaSumaConfigFields
                  idPrefix={`suma-${editandoSuma}`}
                  valores={formSuma}
                  errores={intentoSuma ? erroresSuma : {}}
                  disabled={guardandoSuma}
                  onChange={(cambios) => setFormSuma((prev) => ({ ...prev, ...cambios }))}
                />
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" disabled={guardandoSuma} onClick={() => setEditandoSuma(null)}>
                    Cancelar
                  </Button>
                  <Button type="button" disabled={guardandoSuma} onClick={() => void guardarSuma()}>
                    {guardandoSuma ? 'Guardando…' : 'Guardar suma asegurada'}
                  </Button>
                </div>
              </div>
            )}
          </SectionPanel>
        )}

        </div>

        <div id="paso-tablas" className="scroll-mt-20">
        {personas && (
          <SectionPanel
            title="5 · Tablas por edad y asegurados"
            description="Quiénes entran al plan (parentescos, sexo, edades) y con qué tabla de precios por edad se calcula la prima de cada cobertura."
            icon={Users}
          >
            <Alert variant="info" className="mb-4">
              <p className="font-semibold">¿Qué prima se cobra en un plan de personas?</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                <li>
                  <strong>Manda la tabla por edad.</strong> Al cotizar o emitir, Sis2000 busca el tramo de la edad de cada
                  asegurado en la tabla de la cobertura y cobra la <em>prima fija</em> de ese tramo o, si el tramo trae{' '}
                  <em>tasa %</em>, la tasa × la suma asegurada.
                </li>
                <li>
                  La <strong>prima escrita en la cobertura</strong> (columna «Prima» del paso 4) se graba en el plan, pero no
                  reemplaza a la tabla: déjala en 0 si la prima sale de la tabla, para que nadie se confunda.
                </li>
                <li>
                  La <strong>suma asegurada</strong> sí sale de la cobertura (columna «Suma asegurada»), y es la que se usa
                  cuando la tabla cobra por tasa.
                </li>
              </ul>
              <p className="mt-1">En «Revisar y crear» verás, cobertura por cobertura, cómo quedará el cálculo.</p>
            </Alert>
            <div className="mb-4 rounded-xl border border-border/60 bg-muted/20 p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                <Users className="h-3.5 w-3.5" />
                Asegurados del plan (personas)
              </p>
              <FormGrid>
                <FormField
                  span={2}
                  label="Parentescos"
                  htmlFor="combo-cparen-texto"
                  hint="Marca quiénes pueden entrar al plan (Titular es el asegurado principal)."
                  tooltip="Parentescos que admite el plan (catálogo maparent de Sis2000). Cada cobertura incluida se graba para cada parentesco con las mismas edades, suma, prima y tabla de tasas."
                  error={intentoCrear && !cparens ? 'Marca al menos un parentesco.' : undefined}
                >
                  <ParentescosSelector
                    idPrefix="combo-cparen"
                    value={parentescosTxt}
                    onChange={setParentescosTxt}
                    onCatalogo={setParentescosCat}
                  />
                </FormField>
                <FormField
                  label="Sexo (csexo)"
                  htmlFor="combo-csexo"
                  tooltip="Sexo al que aplica cada parentesco: ambos, masculino o femenino."
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
                <FormField
                  label="Edad mínima"
                  htmlFor="combo-edad-min"
                  tooltip="Edad mínima del asegurado para entrar al plan (nedad_min)."
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
                  label="Edad máxima"
                  htmlFor="combo-edad-max"
                  tooltip="Edad máxima del asegurado para entrar al plan (nedad_max)."
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
                <FormField
                  label="Tabla de tasas por edad (ctablatar)"
                  htmlFor="combo-tabla"
                  hint="Máx. 10 caracteres. La usan todas las coberturas que no indiquen otra en la columna «Tabla de tasas»."
                  tooltip={'Código de la tabla de precios por edad (mapltabedad_d). Créala con "Crear tabla" o usa una existente.'}
                >
                  <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                    <Input
                      id="combo-tabla"
                      value={tablaPlan}
                      maxLength={10}
                      placeholder="TEMP1"
                      onChange={(e) => setTablaPlan(e.target.value.toUpperCase())}
                    />
                    <Button type="button" size="sm" className="shrink-0" onClick={() => abrirBuscadorTabla('plan')}>
                      <Search className="h-3.5 w-3.5" />
                      Elegir
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => abrirCrearTabla('plan')}>
                      Crear tabla
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      disabled={!tablaPlan.trim()}
                      onClick={() => abrirVerTabla(tablaPlan)}
                    >
                      Ver
                    </Button>
                  </div>
                </FormField>
              </FormGrid>
            </div>
            <div className="rounded-xl border border-border/60 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Tabla de cada cobertura</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!incluidas.length}
                    onClick={() => abrirBuscadorTabla('plan')}
                  >
                    <Search className="h-3.5 w-3.5" />
                    Misma tabla en todas
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={!tablaPlan.trim() || !Object.values(filasPer).some((f) => f.ctablatar.trim())}
                    onClick={usarTablaDelPlanEnTodas}
                    title="Quita la tabla propia de cada cobertura: todas usan la tabla del plan."
                  >
                    Usar la del plan en todas
                  </Button>
                </div>
              </div>
              {!incluidas.length ? (
                <p className="text-xs text-muted-foreground">Marca coberturas en el paso 4 para asignarles tabla.</p>
              ) : (
                <ul className="divide-y divide-border/50">
                  {incluidas.map((v) => {
                    const cc = v.cobertura.ccobertura;
                    const propia = filaPer(cc).ctablatar.trim();
                    const tabla = tablaDe(cc);
                    const leida = tabla ? tablasLeidas[tabla.toUpperCase()] : undefined;
                    return (
                      <li key={cc} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                        <span className="min-w-0">
                          <span className="font-mono font-semibold">{cc}</span>
                          {v.cobertura.descripcion && <span className="text-muted-foreground"> · {v.cobertura.descripcion}</span>}
                        </span>
                        <span className="flex flex-wrap items-center gap-2">
                          {tabla ? (
                            <Badge variant={propia ? 'submitted' : 'default'} className="px-2 py-0 text-[11px]">
                              {tabla}
                              {!propia && ' (del plan)'}
                            </Badge>
                          ) : (
                            <span className="font-semibold text-rose-600">Sin tabla</span>
                          )}
                          {leida === 'error' && <span className="text-rose-600">no existe en Sis2000</span>}
                          {leida && leida !== 'error' && leida !== 'cargando' && (
                            <span className="text-muted-foreground">
                              {(leida.tramos ?? []).length} tramo{(leida.tramos ?? []).length === 1 ? '' : 's'}
                            </span>
                          )}
                          <button
                            type="button"
                            className="font-bold text-indigo-600 hover:underline"
                            onClick={() => abrirBuscadorTabla(cc, v.cobertura.descripcion)}
                          >
                            Elegir
                          </button>
                          <button
                            type="button"
                            className="font-bold text-indigo-600 hover:underline"
                            onClick={() => abrirCrearTabla(cc, v.cobertura.descripcion)}
                          >
                            Crear
                          </button>
                          <button
                            type="button"
                            className="font-bold text-slate-500 hover:underline disabled:opacity-40"
                            disabled={!tabla}
                            onClick={() => abrirVerTabla(tabla)}
                          >
                            Ver
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
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
            </div>
          </SectionPanel>
        )}
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div id="paso-datos" className="min-w-0 scroll-mt-20 space-y-5 lg:col-span-2">
          <SectionPanel
            title="6 · Datos del plan"
            description={`Cabecera del plan en Sis2000 (${personas ? 'maplanes_per' : 'maplanes'}), frecuencias de pago y quién puede venderlo (mausuplan).`}
            icon={FileText}
          >
            <FormGrid>
              <FormField
                label="Código del plan (cplan)"
                htmlFor="combo-cplan"
                hint="Máx. 6 caracteres, en mayúsculas."
                tooltip="Clave del plan dentro del ramo. Con el ramo identifica el plan en Sis2000 y es la que usa la emisión."
                error={intentoCrear && !cplan.trim() ? 'Escribe el código del plan.' : undefined}
              >
                <Input
                  id="combo-cplan"
                  value={cplan}
                  maxLength={6}
                  placeholder="RCG01"
                  onChange={(e) => setCplan(e.target.value.toUpperCase())}
                />
              </FormField>
              <FormField
                label="Nombre del plan (xplan)"
                htmlFor="combo-xplan"
                hint="Máx. 60 caracteres."
                tooltip="Nombre del plan que muestran SysIP y la emisión."
                error={intentoCrear && !xplan.trim() ? 'Escribe el nombre del plan.' : undefined}
              >
                <Input
                  id="combo-xplan"
                  value={xplan}
                  maxLength={60}
                  onChange={(e) => setXplan(e.target.value)}
                />
              </FormField>
              <FormField
                label="Vigencia desde (fdesde)"
                htmlFor="combo-fdesde"
                tooltip="Desde qué fecha se puede emitir con el plan."
              >
                <Input
                  id="combo-fdesde"
                  type="date"
                  value={fdesde}
                  onChange={(e) => setFdesde(e.target.value)}
                />
              </FormField>
              <FormField
                label="Vigencia hasta (fhasta)"
                htmlFor="combo-fhasta"
                tooltip="Hasta qué fecha se puede emitir con el plan."
                error={fdesde && fhasta && fdesde > fhasta ? 'La fecha «hasta» debe ser posterior a «desde».' : undefined}
              >
                <Input
                  id="combo-fhasta"
                  type="date"
                  value={fhasta}
                  onChange={(e) => setFhasta(e.target.value)}
                />
              </FormField>
              <FormField
                label="Moneda (cmoneda)"
                htmlFor="combo-cmoneda"
                tooltip="Moneda del plan. Se sugiere la que usan las coberturas del ramo."
              >
                {monedas.length ? (
                  <Select value={cmoneda} onValueChange={setCmoneda}>
                    <SelectTrigger id="combo-cmoneda">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {opcionesDeMoneda.map((m) => (
                        <SelectItem key={m.codigo} value={m.codigo}>
                          {m.codigo}
                          {m.nombre ? ` · ${m.nombre}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="combo-cmoneda"
                    value={cmoneda}
                    maxLength={3}
                    onChange={(e) => setCmoneda(e.target.value)}
                  />
                )}
              </FormField>
              <FormField
                label="Frecuencias de pago"
                tooltip="Fraccionamientos que admite el plan (maplanes_frec). Marca al menos una."
              >
                <div className="flex flex-wrap gap-2">
                  {FRECUENCIAS.map((f) => (
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
                label="Quién puede venderlo"
                tooltip="Productor que ve el plan en SysIP (mausuplan) o todos los productores."
              >
                <ProductoresSelector idPrefix="combo-prod" value={productoresSel} onChange={setProductoresSel} />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Hoy Sis2000 exige al menos un productor o «Todos» al crear el plan (no se puede dejar en blanco). Después
                  de creado puedes cambiar a quién se asigna desde «Editar plan».
                </p>
              </FormField>
              <FormField
                span={2}
                label="Canales alternos que pueden venderlo"
                tooltip="Canales alternos (mausuplan, entidad C) que ven el plan: ninguno, uno o varios, o todos. Se guardan por plan y solo se agregan (nunca se borran)."
              >
                <CanalesSelector
                  idPrefix="combo-canal"
                  value={canalesSel}
                  onChange={setCanalesSel}
                  deshabilitado={!canalesHabilitados}
                />
              </FormField>
            </FormGrid>
          </SectionPanel>

          {/* Igual que en Planes maestro: antes de crear quedan pendientes y se agregan al crear el plan. */}
          <ProveedoresPlanPanel
            key={proveedoresKey}
            className="mt-0"
            planId={planCreado ? sis2000PlanMasterId(planCreado.cramo, planCreado.cplan) : null}
          />
          {/* Tipo de emisión (cobro por días): como los proveedores, antes de crear queda pendiente y se guarda al
              crear el plan. Si no se activa, nada cambia. */}
          <CobroDiasPanel
            key={`cd-${proveedoresKey}`}
            className="mt-0"
            planId={planCreado ? sis2000PlanMasterId(planCreado.cramo, planCreado.cplan) : null}
            coberturas={incluidas.map((v) => ({ ccobertura: v.cobertura.ccobertura, nombre: v.cobertura.descripcion }))}
            obligatorias={incluidas
              .filter((v) => (personas ? filaPer(v.cobertura.ccobertura).obligatoria : v.obligatoria))
              .map((v) => v.cobertura.ccobertura)}
            cmonedaDefault={cmoneda.trim() || '$'}
          />
          </div>

          <Card className="h-fit lg:sticky lg:top-20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resumen del combo</CardTitle>
              <CardDescription>
                {producto ? `Producto ${cproducto} · ramo ${cramo || '—'}` : 'Sin producto elegido'} ·{' '}
                {personas ? 'plan de personas' : 'plan de cosas'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="space-y-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Coberturas incluidas</dt>
                  <dd className="font-semibold">{incluidas.length}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">
                    {personas ? 'Suma asegurada más alta' : 'Suma máxima más alta'}
                  </dt>
                  <dd className="font-semibold">
                    {cmoneda} {formatoMonto(resumen.sumaMaxima)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">
                    {personas ? 'Prima por persona (suma de coberturas)' : 'Prima de referencia'}
                  </dt>
                  <dd className="font-semibold">
                    {cmoneda} {formatoMonto(resumen.prima)}
                  </dd>
                </div>
                {personas && (
                  <>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted-foreground">Parentescos</dt>
                      <dd className="font-semibold">
                        {cparens ? cparens.map(nombreParen).join(', ') : '—'} · {SEXOS.find((s) => s.valor === csexo)?.etiqueta}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted-foreground">Edades</dt>
                      <dd className="font-semibold">
                        {edadMin || '—'} a {edadMax || '—'} años
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted-foreground">Tabla de tasas</dt>
                      <dd className="font-semibold">{tablaPlan.trim() || '—'}</dd>
                    </div>
                  </>
                )}
              </dl>
              <p className="text-[0.72rem] leading-relaxed text-slate-500">
                {personas
                  ? 'Solo referencia: suma de las primas escritas por cobertura. Si la prima sale de la tabla de tasas por edad, la calcula Sis2000 al emitir según la edad del asegurado.'
                  : 'Solo referencia, calculada con las sumas máximas: tasa × suma máxima ÷ 100, o la prima fija si la cobertura no tiene tasa. La prima real la calcula Sis2000 al cotizar el plan.'}
              </p>
              <Button type="button" className="w-full" onClick={crear} disabled={creando}>
                <Send className="h-4 w-4" />
                {creando ? 'Creando plan…' : 'Crear plan en Sis2000'}
              </Button>
              <button
                type="button"
                className="w-full text-center text-xs font-medium text-primary hover:underline"
                onClick={() => irA('paso-revisar')}
              >
                Ver la revisión completa antes de crear
              </button>
            </CardContent>
          </Card>
        </div>

        <div id="paso-revisar" className="scroll-mt-20">
          <SectionPanel
            title="7 · Revisar y crear"
            description="Así quedará el plan en Sis2000. Revisa cada dato antes de crearlo; puedes volver a cualquier paso con la barra de arriba."
            icon={ClipboardCheck}
          >
            {errores.length > 0 ? (
              <Alert variant="warning" className="mb-4">
                <p className="font-semibold">
                  Falta{errores.length === 1 ? '' : 'n'} {errores.length} cosa{errores.length === 1 ? '' : 's'} para poder crear el plan:
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {errores.map((e, i) => (
                    <li key={`rev-${i}-${e}`}>{e}</li>
                  ))}
                </ul>
              </Alert>
            ) : (
              <Alert variant="success" className="mb-4">
                Todo listo: revisa el resumen y pulsa «Crear plan en Sis2000».
              </Alert>
            )}
            {avisosPersonas.length > 0 && (
              <Alert variant="warning" className="mb-4">
                <ul className="list-disc space-y-0.5 pl-5">
                  {avisosPersonas.map((a) => (
                    <li key={`rev-${a}`}>{a}</li>
                  ))}
                </ul>
              </Alert>
            )}

            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {(
                [
                  ['Producto', producto ? `${cproducto} · ${texto(producto.xdescripcion_l) || 'Sin nombre'}` : '—', 'paso-producto'],
                  ['Ramo', cramo ? (opcionesRamo.find((r) => r.cramo === cramo)?.etiqueta ?? `Ramo ${cramo}`) : '—', 'paso-ramo'],
                  ['Tipo de plan', personas ? 'Personas' : 'Cosas (patrimonial)', 'paso-tipo'],
                  ['Plan', cplan.trim() ? `${cplan.trim()} · ${xplan.trim() || 'sin nombre'}` : '—', 'paso-datos'],
                  ['Vigencia', `${fdesde || '—'} a ${fhasta || '—'}`, 'paso-datos'],
                  ['Moneda', cmoneda || '—', 'paso-datos'],
                  [
                    'Frecuencias de pago',
                    FRECUENCIAS.filter((f) => frecuencias.includes(f.ifrecuencia)).map((f) => f.xfrecuencia).join(', ') || '—',
                    'paso-datos',
                  ],
                  [
                    'Quién lo vende',
                    productoresSel.todos
                      ? 'Todos los productores'
                      : productoresSel.productores
                          .map((p) => (p.xproductor ? `${p.cproductor} · ${p.xproductor}` : String(p.cproductor)))
                          .join(', ') || '—',
                    'paso-datos',
                  ],
                  ...(personas
                    ? ([
                        ['Parentescos', cparens ? cparens.map(nombreParen).join(', ') : '—', 'paso-tablas'],
                        [
                          'Sexo y edades',
                          `${SEXOS.find((s) => s.valor === csexo)?.etiqueta ?? csexo} · ${edadMin || '—'} a ${edadMax || '—'} años`,
                          'paso-tablas',
                        ],
                      ] as Array<[string, string, string]>)
                    : []),
                ] as Array<[string, string, string]>
              ).map(([etiqueta, valor, paso]) => (
                <div key={etiqueta} className="flex items-baseline justify-between gap-3 border-b border-border/40 py-1">
                  <dt className="text-muted-foreground">{etiqueta}</dt>
                  <dd className="flex items-baseline gap-2 text-right font-medium">
                    <span className="break-words">{valor}</span>
                    <button
                      type="button"
                      className="text-[11px] font-normal text-primary hover:underline"
                      onClick={() => irA(paso)}
                    >
                      Cambiar
                    </button>
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mb-2 mt-5 text-sm font-semibold">
              Coberturas del plan ({incluidas.length}) · así se calculará
            </p>
            {!incluidas.length ? (
              <p className="text-xs text-muted-foreground">Todavía no marcaste coberturas (paso 4).</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border/60">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="bg-muted/30 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Cobertura</th>
                      <th className="px-3 py-2">Tarifa</th>
                      <th className="px-3 py-2">Obligatoria</th>
                      <th className="px-3 py-2 text-right">Suma asegurada</th>
                      <th className="px-3 py-2">Cómo se calcula la prima</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incluidas.map((v) => {
                      const cc = v.cobertura.ccobertura;
                      const f = v.fila;
                      const oblig = personas ? filaPer(cc).obligatoria : v.obligatoria;
                      let suma: string;
                      let calculo: ReactNode;
                      if (personas) {
                        const sumaNum = numero(f.msumamax);
                        suma = sumaNum > 0 ? `${cmoneda} ${formatoMonto2(sumaNum)}` : '—';
                        const tabla = tablaDe(cc).toUpperCase();
                        const leida = tabla ? tablasLeidas[tabla] : undefined;
                        calculo = !tabla ? (
                          <span className="font-semibold text-rose-600">Falta la tabla por edad</span>
                        ) : leida === 'cargando' || leida === undefined ? (
                          <span className="text-muted-foreground">Tabla {tabla}: leyendo tramos…</span>
                        ) : leida === 'error' ? (
                          <span className="text-rose-600">La tabla {tabla} no se encontró en Sis2000</span>
                        ) : (
                          <div className="space-y-0.5">
                            <p className="font-medium">Tabla {tabla} (según la edad del asegurado):</p>
                            <ul className="space-y-0.5">
                              {(leida.tramos ?? []).slice(0, 8).map((t) => (
                                <li key={`${t.nedad_min}-${t.nedad_max}`}>
                                  {t.nedad_min} a {t.nedad_max} años: {precioTramo(t, sumaNum, cmoneda)}
                                </li>
                              ))}
                              {(leida.tramos ?? []).length > 8 && (
                                <li className="text-muted-foreground">… y {(leida.tramos ?? []).length - 8} tramos más</li>
                              )}
                            </ul>
                            {numero(f.mprima) > 0 && (
                              <p className="text-amber-700">
                                La prima escrita en la cobertura ({cmoneda} {formatoMonto2(numero(f.mprima))}) se graba, pero
                                manda la tabla.
                              </p>
                            )}
                          </div>
                        );
                      } else if (v.calculada) {
                        suma = 'Al emitir';
                        calculo = <span>{textoSumaCalculada(v.sumaConfig)}</span>;
                      } else {
                        const min = numero(f.msumamin);
                        const max = numero(f.msumamax);
                        suma =
                          min === max
                            ? `${cmoneda} ${formatoMonto2(max)} (cerrada)`
                            : `${cmoneda} ${formatoMonto2(min)} a ${formatoMonto2(max)}`;
                        const tasa = numero(f.pprima);
                        calculo =
                          tasa > 0 ? (
                            <span>
                              Tasa {tasa.toLocaleString('es-VE', { maximumFractionDigits: 6 })} % × suma (con la máxima:{' '}
                              {cmoneda} {formatoMonto2((max * tasa) / 100)})
                            </span>
                          ) : numero(f.mprima) > 0 ? (
                            <span>
                              Prima fija {cmoneda} {formatoMonto2(numero(f.mprima))}
                            </span>
                          ) : (
                            <span className="font-semibold text-rose-600">Sin tasa ni prima</span>
                          );
                      }
                      return (
                        <tr key={cc} className="border-t border-border/40 align-top">
                          <td className="px-3 py-2">
                            <span className="font-mono font-semibold">{cc}</span>
                            {v.cobertura.descripcion && <span className="text-muted-foreground"> · {v.cobertura.descripcion}</span>}
                          </td>
                          <td className="px-3 py-2">{f.ctarifa || '—'}</td>
                          <td className="px-3 py-2">{oblig ? 'Sí' : 'No'}</td>
                          <td className="px-3 py-2 text-right">{suma}</td>
                          <td className="px-3 py-2">{calculo}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
              {errores.length > 0 && (
                <span className="text-xs text-amber-700">Completa lo que falta arriba para poder crear el plan.</span>
              )}
              <Button type="button" onClick={crear} disabled={creando}>
                <Send className="h-4 w-4" />
                {creando ? 'Creando plan…' : 'Crear plan en Sis2000'}
              </Button>
            </div>
          </SectionPanel>
        </div>

        {intentoCrear && errores.length > 0 && (
          <Alert variant="warning">
            <p className="font-semibold">Antes de crear el plan revisa:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {errores.map((e, i) => (
                <li key={`${i}-${e}`}>{e}</li>
              ))}
            </ul>
          </Alert>
        )}

        {errorCrear && <Alert variant="error">{errorCrear}</Alert>}

        {planCreado && (
          <Alert variant="success">
            <p className="font-semibold">
              Plan de {planCreado.tipo} creado en Sis2000: ramo {planCreado.cramo}, plan {planCreado.cplan}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {planCreado.tipo === 'cosas' && (
                <Button type="button" variant="outline" size="sm" onClick={cotizar} disabled={cotizando}>
                  <Calculator className="h-3.5 w-3.5" />
                  {cotizando ? 'Cotizando…' : 'Cotizar en Sis2000'}
                </Button>
              )}
              <Link
                to={`/sis2000/plans/${encodeURIComponent(sis2000PlanMasterId(planCreado.cramo, planCreado.cplan))}/edit`}
                className="text-xs font-medium text-primary underline-offset-2 hover:underline"
              >
                Editar plan
              </Link>
            </div>
          </Alert>
        )}

        {errorCotizar && <Alert variant="error">{errorCotizar}</Alert>}

        {cotizacion && planCreado && (
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <p className="border-b border-border/50 bg-muted/30 px-2 py-2 text-xs font-semibold">
              Cotización Sis2000 · plan {planCreado.cplan} · frecuencia{' '}
              {FRECUENCIAS.find((f) => f.ifrecuencia === planCreado.ifrecuencia)?.xfrecuencia ??
                planCreado.ifrecuencia}
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
                    <td className="p-2">
                      {texto(r.ccober)} · {texto(r.xcobertura)}
                    </td>
                    <td className="p-2 text-right">
                      {Number(r.msumaasegext ?? 0).toLocaleString('es-VE')}
                    </td>
                    <td className="p-2 text-right">
                      {Number(r.mprimaext ?? 0).toLocaleString('es-VE')}
                    </td>
                    <td className="p-2 text-right">
                      {Number(r.mcomisionext ?? 0).toLocaleString('es-VE')}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-border font-semibold">
                  <td className="p-2">Total (moneda del plan)</td>
                  <td className="p-2" />
                  <td className="p-2 text-right">
                    {totalCotizacion('mprimaext').toLocaleString('es-VE')}
                  </td>
                  <td className="p-2 text-right">
                    {totalCotizacion('mcomisionext').toLocaleString('es-VE')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
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
      </div>
    </AppShell>
  );
}
