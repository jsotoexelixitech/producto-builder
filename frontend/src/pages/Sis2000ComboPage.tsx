import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Boxes,
  Calculator,
  FileText,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Shield,
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

  const [productos, setProductos] = useState<Sis2000Product[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState(true);
  const [errorProductos, setErrorProductos] = useState<string | null>(null);
  /** Producto elegido: clave cproducto|cramo (maproductos repite cada producto en SysIP y Nexus). */
  const [claveProducto, setClaveProducto] = useState('');

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

  const [cplan, setCplan] = useState('');
  const [xplan, setXplan] = useState('');
  const [fdesde, setFdesde] = useState(hoyIso);
  const [fhasta, setFhasta] = useState('2099-12-31');
  const [cmoneda, setCmoneda] = useState('$');
  const [monedas, setMonedas] = useState<Array<{ codigo: string; nombre: string }>>([]);
  const [frecuencias, setFrecuencias] = useState<string[]>(['A']);
  /** Quién puede vender el plan: lista de productores (por defecto 80080) o todos. */
  const [productoresSel, setProductoresSel] = useState<ProductoresSelection>(PRODUCTORES_DEFAULT);
  /** Canales alternos (mausuplan C): solo si el servidor lo habilita (SIS2000_PLAN_CANALES). */
  const [canalesSel, setCanalesSel] = useState<CanalesSelection>(CANALES_DEFAULT);
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
  }, []);

  const opcionesProducto = useMemo(() => agruparProductosSis2000(productos), [productos]);
  const opcionProducto = useMemo(
    () => opcionesProducto.find((o) => o.clave === claveProducto) ?? null,
    [opcionesProducto, claveProducto],
  );
  const producto = opcionProducto?.producto ?? null;
  const cproducto = opcionProducto?.cproducto ?? '';
  const cramo = producto && Number(producto.cramo) > 0 ? Number(producto.cramo) : 0;
  const esPersonas = texto(producto?.xform).toLowerCase().startsWith('person');

  // Coberturas del ramo (macoberturas, orden numérico del servidor).
  useEffect(() => {
    generacion.current += 1;
    const gen = generacion.current;
    solicitadas.current = new Set();
    setCatalogo(null);
    setTarifas({});
    setFilas({});
    setSumaConfig({});
    setEditandoSuma(null);
    setErrorCoberturas(null);
    if (!cramo) {
      setCargandoCoberturas(false);
      return;
    }
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
        setCmoneda(monedaDelRamo(coberturas));
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
      if (v.calculada) continue; // la suma llega al emitir
      const suma = numero(v.fila.msumamax);
      const tasa = numero(v.fila.pprima);
      sumaMaxima = Math.max(sumaMaxima, suma);
      prima += tasa > 0 ? (suma * tasa) / 100 : numero(v.fila.mprima);
    }
    return { sumaMaxima, prima };
  }, [incluidas]);

  /** CreatePlanDto de cosas con las coberturas incluidas, listo para POST /core/sis2000/plans. */
  function armarPayload(): Record<string, unknown> {
    const payload = defaultPlanPayload({
      type: 'cosas',
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
      setPlanCreado({ cramo, cplan: String(payload.cplan), ifrecuencia });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setErrorCrear(
          `Ya existe un plan con ese código en el ramo ${cramo} (${cplan.trim()}). Usa otro código de plan.`,
        );
      } else {
        setErrorCrear(e instanceof Error ? e.message : 'Error al crear el plan en Sis2000');
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

  function elegirProducto(valor: string) {
    setClaveProducto(valor);
    setIntentoCrear(false);
    setMostrarNuevaCobertura(false);
    setAvisoCobertura(null);
    limpiarResultado();
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

  return (
    <AppShell title="Combos de coberturas">
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
            nest-api POST /api/v1/configurador/planes → spMantPlanes (maplanes, maplantar,
            maplanes_frec, mausuplan)
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={recargar} disabled={ocupado}>
          <RefreshCw className={cn('h-3.5 w-3.5', ocupado && 'animate-spin')} />
          Recargar
        </Button>
      </div>

      <p className="mb-1 max-w-4xl text-sm text-muted-foreground">
        Elige el producto, marca las coberturas de su ramo que forman el combo y ajusta sumas, tasa o
        prima fija. Al crear, el configurador da de alta en Sis2000 un plan con exactamente esas
        coberturas (maplantar) y la emisión usa ese plan.
      </p>
      <p className="mb-4 max-w-4xl text-xs text-amber-800 dark:text-amber-200">
        Solo planes de cosas: suma asegurada con tasa o prima fija por cobertura. Los planes de
        personas (parentescos y tablas de tasas por edad) se crean desde Planes maestro.
      </p>

      <div className="space-y-5">
        <SectionPanel
          title="Producto Sis2000"
          description="El plan se crea en el ramo del producto; de ese ramo salen las coberturas y tarifas."
          icon={Package}
        >
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
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
                    {opcionesProducto.map((o) => (
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
          {esPersonas && (
            <Alert variant="warning" className="mt-3">
              Este producto usa el formulario de personas. Aquí solo se crean planes de cosas; los
              planes con parentescos y tablas por edad se crean desde Planes maestro.
            </Alert>
          )}
        </SectionPanel>

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

        {cramo > 0 && (
          <SectionPanel
            title={`Coberturas del ramo ${cramo}`}
            description="Marca las que forman el combo. Sumas, tasa y prima fija vienen del detalle vigente de la tarifa (matarifa_d); si los cambias, solo aplican a este plan (maplantar)."
            icon={Shield}
          >
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
                          <InfoTip text="Solo lectura. En planes de cosas no se guarda por plan: sale de la tarifa (matarifa.bobligatoria). La cobertura 1 es la básica. Las obligatorias entran marcadas." />
                        </span>
                      </th>
                      {MONTOS.map((m) => (
                        <th key={m.campo} className="px-3 py-2 text-right">
                          <span className="inline-flex items-center gap-1">
                            {m.etiqueta}
                            <InfoTip text={m.ayuda} />
                          </span>
                        </th>
                      ))}
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
                            {v.calculada && (
                              <Badge variant="actuarial" className="ml-2 px-2 py-0 text-[10px]">
                                Suma calculada al emitir
                              </Badge>
                            )}
                            <button
                              type="button"
                              className="ml-2 inline-flex items-center align-middle text-muted-foreground hover:text-foreground"
                              title="Suma asegurada: fija o calculada al emitir"
                              aria-label={`Editar suma asegurada de la cobertura ${c.ccobertura}`}
                              onClick={() => abrirEditorSuma(v)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </td>
                          <td className="px-3 py-2 text-xs">{celdaTarifa(v)}</td>
                          <td className="px-3 py-2 text-xs">
                            {v.obligatoria ? (
                              <Badge variant="submitted">Obligatoria</Badge>
                            ) : (
                              <Badge>Opcional</Badge>
                            )}
                          </td>
                          {v.calculada ? (
                            <td colSpan={MONTOS.length} className="px-3 py-2 text-xs font-medium text-amber-800">
                              {textoSumaCalculada(v.sumaConfig)}
                              <span className="ml-1 font-normal text-muted-foreground">
                                · unidades × valor por unidad; en el plan se graba en 0
                              </span>
                            </td>
                          ) : (
                          MONTOS.map((m) => (
                            <td key={m.campo} className="px-2 py-2 text-right">
                              {fila && habilitada ? (
                                <Input
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  step="any"
                                  aria-label={`${m.etiqueta} · cobertura ${c.ccobertura}`}
                                  value={fila[m.campo]}
                                  onChange={(e) => cambiarMonto(c.ccobertura, m.campo, e.target.value)}
                                  className="ml-auto h-8 w-28 rounded-lg px-2 py-1 text-right text-xs"
                                />
                              ) : (
                                <span className="text-xs">—</span>
                              )}
                            </td>
                          ))
                          )}
                        </tr>
                      );
                    })}
                    {filtradas.length === 0 && (
                      <tr>
                        <td colSpan={5 + MONTOS.length} className="px-3 py-6 text-center text-xs text-muted-foreground">
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

            {editandoSuma && (
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

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="min-w-0 space-y-5 lg:col-span-2">
          <SectionPanel
            title="Datos del plan"
            description="Cabecera del plan en Sis2000 (maplanes), frecuencias de pago (maplanes_frec) y quién puede venderlo (mausuplan)."
            icon={FileText}
          >
            <FormGrid>
              <FormField
                label="Código del plan (cplan)"
                htmlFor="combo-cplan"
                hint="Máx. 6 caracteres, en mayúsculas."
                tooltip="Clave del plan dentro del ramo. Con el ramo identifica el plan en Sis2000 y es la que usa la emisión."
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
          {/* Tipo de emisión (cobro por días): solo cuando el plan ya existe; si no se activa, nada cambia. */}
          {planCreado && (
            <CobroDiasPanel
              key={`cd-${proveedoresKey}`}
              className="mt-0"
              planId={sis2000PlanMasterId(planCreado.cramo, planCreado.cplan)}
              coberturas={incluidas.map((v) => ({ ccobertura: v.cobertura.ccobertura, nombre: v.cobertura.descripcion }))}
              cmonedaDefault={cmoneda.trim() || '$'}
            />
          )}
          </div>

          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resumen del combo</CardTitle>
              <CardDescription>
                {producto ? `Producto ${cproducto} · ramo ${cramo || '—'}` : 'Sin producto elegido'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="space-y-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Coberturas incluidas</dt>
                  <dd className="font-semibold">{incluidas.length}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Suma máxima más alta</dt>
                  <dd className="font-semibold">
                    {cmoneda} {formatoMonto(resumen.sumaMaxima)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Prima de referencia</dt>
                  <dd className="font-semibold">
                    {cmoneda} {formatoMonto(resumen.prima)}
                  </dd>
                </div>
              </dl>
              <p className="text-[0.72rem] leading-relaxed text-slate-500">
                Solo referencia, calculada con las sumas máximas: tasa × suma máxima ÷ 100, o la
                prima fija si la cobertura no tiene tasa. La prima real la calcula Sis2000 al cotizar
                el plan.
              </p>
              <Button type="button" className="w-full" onClick={crear} disabled={creando}>
                <Send className="h-4 w-4" />
                {creando ? 'Creando plan…' : 'Crear plan en Sis2000'}
              </Button>
            </CardContent>
          </Card>
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
              Plan creado en Sis2000: ramo {planCreado.cramo}, plan {planCreado.cplan}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={cotizar} disabled={cotizando}>
                <Calculator className="h-3.5 w-3.5" />
                {cotizando ? 'Cotizando…' : 'Cotizar en Sis2000'}
              </Button>
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

      </div>
    </AppShell>
  );
}
