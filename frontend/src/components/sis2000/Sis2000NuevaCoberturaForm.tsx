import { useEffect, useMemo, useState } from 'react';
import { Plus, Shield } from 'lucide-react';
import { api } from '@/lib/api';
import type { CoberturaSumaConfig, Sis2000NestRow } from '@/lib/sis2000-nest-api';
import {
  formNuevaCobertura,
  nombreCortoPorDefecto,
  payloadCobertura,
  payloadSumaConfig,
  payloadTarifa,
  validarNuevaCobertura,
  type ErroresNuevaCobertura,
  type NuevaCoberturaForm,
} from '@/lib/sis2000-nueva-cobertura';
import { CoberturaSumaConfigFields } from '@/components/sis2000/CoberturaSumaConfigFields';
import { ConfirmarDialog, DetallesTecnicos } from '@/components/sis2000/AsistentePasos';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField, FormGrid } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { InfoTip } from '@/components/ui/info-tip';
import { ComboBuscable } from '@/components/ui/combo-buscable';
import { AlertaError, ResumenErrores, type ErrorDeCampo } from '@/components/ui/errores';
import { entenderError, type ErrorEntendible } from '@/lib/errores';
import { textoDeducible } from '@/lib/configurador';
import { DeducibleCampos } from '@/components/configurador/DeducibleCampos';
import { useAvisoSinGuardar } from '@/components/ui/aviso-sin-guardar';
import { LISTA_CONTRATOS_REASEGURO, LISTA_RAMOS_REASEGURO, ReaseguroListas } from '@/components/configurador/ReaseguroListas';

const ETIQUETA_OPCION =
  'inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-xs font-medium';
const SUBTITULO = 'mb-3 mt-1 text-xs font-bold uppercase tracking-wide text-slate-500';
const SIN_BASE = '__ninguna__';
const SECCION_CODIGOS = 'Códigos y datos internos';

/** Campo del formulario → id del input, nombre en pantalla y sección plegada donde está (si aplica). */
const CAMPOS: Partial<Record<keyof NuevaCoberturaForm, { id: string; etiqueta: string; seccion?: string }>> = {
  xdescripcion_l: { id: 'nc-xl', etiqueta: 'Nombre de la cobertura' },
  xdescripcion_c: { id: 'nc-xc', etiqueta: 'Nombre corto' },
  cmoneda: { id: 'nc-cmoneda', etiqueta: 'Moneda' },
  xabreviatura: { id: 'nc-xab', etiqueta: 'Abreviatura' },
  unidadCalculo: { id: 'nc-suma-unidad', etiqueta: 'Unidad de cálculo' },
  etiquetaCuadro: { id: 'nc-suma-etiqueta', etiqueta: 'Etiqueta en el cuadro póliza' },
  fdesde: { id: 'nc-fdesde', etiqueta: 'Vigente desde' },
  fhasta: { id: 'nc-fhasta', etiqueta: 'Vigente hasta' },
  msumamin: { id: 'nc-msumamin', etiqueta: 'Suma asegurada mínima' },
  msumamax: { id: 'nc-msumamax', etiqueta: 'Suma asegurada máxima' },
  pprima: { id: 'nc-pprima', etiqueta: 'Tasa %' },
  mprima: { id: 'nc-mprima', etiqueta: 'Prima fija' },
  deducible: { id: 'nc-ded-bfraded', etiqueta: 'Deducible' },
  ccobertura: { id: 'nc-ccobertura', etiqueta: 'Código de la cobertura', seccion: SECCION_CODIGOS },
  ctarifa: { id: 'nc-ctarifa', etiqueta: 'Código de la tarifa', seccion: SECCION_CODIGOS },
  xtarifam: { id: 'nc-xtarifam', etiqueta: 'Nombre interno de la tarifa', seccion: SECCION_CODIGOS },
  cramoint: { id: 'nc-cramoint', etiqueta: 'Ramo interno', seccion: SECCION_CODIGOS },
  ccoberturaint: { id: 'nc-ccobint', etiqueta: 'Cobertura interna', seccion: SECCION_CODIGOS },
  ccontrea: { id: 'nc-ccontrea', etiqueta: 'Contrato de reaseguro', seccion: SECCION_CODIGOS },
  cramorea: { id: 'nc-cramorea', etiqueta: 'Ramo de reaseguro', seccion: SECCION_CODIGOS },
};
/** Orden del resumen = orden en pantalla. */
const ORDEN_CAMPOS = Object.keys(CAMPOS) as Array<keyof NuevaCoberturaForm>;
/** Propiedad de los DTO de nest-api → campo del formulario (para llevar al campo un error del servidor). */
const PROPIEDAD_A_CAMPO: Record<string, keyof NuevaCoberturaForm> = {
  ccober: 'ccobertura',
  xtarifa: 'xdescripcion_l',
};

const texto = (v: unknown) => (v == null ? '' : String(v).trim());

export interface CoberturaCreada {
  cramo: number;
  ccobertura: string;
  ctarifa: string;
  /** Nombre de la cobertura (para los avisos). */
  nombre: string;
  /** Suma asegurada (FIJA / CALCULADA) guardada en el configurador; null si quedó FIJA. */
  sumaConfig: CoberturaSumaConfig | null;
}

interface Props {
  cramo: number;
  /** Coberturas actuales del ramo (todas, también inactivas): para sugerir el código y no repetirlo. */
  existentes: Sis2000NestRow[];
  /** Moneda sugerida (la más usada en el ramo). */
  monedaSugerida?: string;
  onCreada: (creada: CoberturaCreada) => void;
  onCancelar?: () => void;
}

/**
 * Alta de cobertura en un ramo con su tarifa y su detalle vigente (macoberturas → matarifa → matarifa_d),
 * por nest-api v1/configurador. Sin tarifa vigente la cobertura no se puede usar en un plan.
 */
export function Sis2000NuevaCoberturaForm({
  cramo,
  existentes,
  monedaSugerida = '$',
  onCreada,
  onCancelar,
}: Props) {
  const [form, setForm] = useState<NuevaCoberturaForm>(() =>
    formNuevaCobertura(existentes, monedaSugerida),
  );
  const [monedas, setMonedas] = useState<Array<{ codigo: string; nombre: string }>>([]);
  const [intento, setIntento] = useState(false);
  const [guardando, setGuardando] = useState(false);
  /** Aviso de un paso que quedó a medias (cobertura creada pero falta la tarifa). */
  const [aviso, setAviso] = useState<string | null>(null);
  /** Error del servidor ya traducido, con lo que se intentaba hacer. */
  const [errorServidor, setErrorServidor] = useState<{ titulo: string; error: ErrorEntendible } | null>(null);
  /** Campos que el usuario ya dejó (se validan al salir del campo, no mientras escribe). */
  const [tocados, setTocados] = useState<Set<string>>(() => new Set());
  /** Código de la cobertura ya grabada cuando falló la tarifa (se reintenta solo la tarifa). */
  const [coberturaGrabada, setCoberturaGrabada] = useState<string | null>(null);
  /** Configuración de suma ya guardada en el configurador (se reintenta si falló). */
  const [sumaGrabada, setSumaGrabada] = useState<CoberturaSumaConfig | null>(null);
  /** Pide confirmación antes de escribir en Sis2000. */
  const [confirmando, setConfirmando] = useState(false);
  // Aviso al salir con cambios sin guardar: se compara con el formulario inicial (los códigos sugeridos no cuentan).
  const [formInicial] = useState(() => JSON.stringify(form));
  const { dialogo: dialogoSalida, permitirSalida } = useAvisoSinGuardar(JSON.stringify(form) !== formInicial);

  useEffect(() => {
    api
      .listSis2000CatalogMonedas()
      .then((rows) => {
        const vistas = new Set<string>();
        const out: Array<{ codigo: string; nombre: string }> = [];
        for (const m of rows) {
          const codigo = texto(m.cmoneda ?? m.codigo ?? m.cvalor);
          if (!codigo || vistas.has(codigo)) continue;
          vistas.add(codigo);
          out.push({ codigo, nombre: texto(m.xmoneda ?? m.xdescripcion_l ?? m.xdescripcion ?? m.descripcion) });
        }
        setMonedas(out);
      })
      .catch(() => undefined);
  }, []);

  const conCodigo = useMemo(
    () =>
      existentes
        .filter((c) => texto(c.ccobertura))
        .sort((a, b) => texto(a.ccobertura).localeCompare(texto(b.ccobertura), 'es', { numeric: true })),
    [existentes],
  );

  const errores: ErroresNuevaCobertura = useMemo(() => {
    const e = validarNuevaCobertura(form, coberturaGrabada ? [] : existentes);
    return e;
  }, [form, existentes, coberturaGrabada]);
  const hayErrores = Object.keys(errores).length > 0;
  const err = (campo: keyof NuevaCoberturaForm) =>
    intento || tocados.has(campo) ? errores[campo] : undefined;
  /** Resumen de arriba: cada error con su campo (solo menciona «Códigos y datos internos» si el error está ahí). */
  const resumen: ErrorDeCampo[] = ORDEN_CAMPOS.filter((c) => errores[c]).map((c) => ({
    id: CAMPOS[c]?.id,
    etiqueta: CAMPOS[c]?.etiqueta,
    mensaje: errores[c] as string,
    seccion: CAMPOS[c]?.seccion,
  }));

  function marcarTocado(id: string) {
    const campo = ORDEN_CAMPOS.find((c) => CAMPOS[c]?.id === id);
    if (campo && !tocados.has(campo)) setTocados((prev) => new Set(prev).add(campo));
  }

  /** id del input para un campo que nest-api rechazó (coberturas o tarifas). */
  function idDePropiedad(propiedad: string): string | undefined {
    const campo = (PROPIEDAD_A_CAMPO[propiedad] ?? propiedad) as keyof NuevaCoberturaForm;
    return CAMPOS[campo]?.id;
  }

  function cambiar<K extends keyof NuevaCoberturaForm>(campo: K, valor: NuevaCoberturaForm[K]) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  function elegirBase(valor: string) {
    if (valor === SIN_BASE) {
      setForm((prev) => ({ ...prev, basadaEn: '', cramoint: '', ccoberturaint: '' }));
      return;
    }
    const base = existentes.find((c) => texto(c.ccobertura) === valor);
    setForm((prev) => ({
      ...prev,
      basadaEn: valor,
      cramoint: texto(base?.cramoint),
      ccoberturaint: texto(base?.ccoberturaint),
    }));
  }

  function pedirConfirmacion(e: React.FormEvent) {
    e.preventDefault();
    setIntento(true);
    setErrorServidor(null);
    // Con errores, el resumen de arriba los lista (clicables); no se pide confirmación.
    if (hayErrores) return;
    setConfirmando(true);
  }

  function crear() {
    return permitirSalida(crearInterno);
  }

  async function crearInterno() {
    setConfirmando(false);
    setErrorServidor(null);
    setAviso(null);
    setGuardando(true);
    const ccobertura = coberturaGrabada ?? form.ccobertura.trim().toUpperCase();
    const nombre = form.xdescripcion_l.trim().toUpperCase() || ccobertura;
    try {
      if (!coberturaGrabada) {
        await api.createSis2000Cobertura(payloadCobertura(cramo, form));
        setCoberturaGrabada(ccobertura);
      }
    } catch (ex) {
      setErrorServidor({ titulo: 'No se pudo crear la cobertura', error: entenderError(ex, { que: 'una cobertura' }) });
      setGuardando(false);
      return;
    }
    // Suma calculada al emitir: vive en la Postgres del configurador (Sis2000 no tiene columnas para esto).
    let sumaConfig = sumaGrabada;
    if (form.tipoSuma === 'CALCULADA' && !sumaConfig) {
      try {
        sumaConfig = await api.upsertSis2000CoberturaSumaConfig(cramo, ccobertura, payloadSumaConfig(form));
        setSumaGrabada(sumaConfig);
      } catch (ex) {
        setAviso(`La cobertura «${nombre}» ya quedó creada. Falta guardar «Suma calculada al emitir» y su tarifa: pulsa «Reintentar» o «Crear tarifa».`);
        setErrorServidor({ titulo: 'No se pudo guardar «Suma calculada al emitir»', error: entenderError(ex) });
        setGuardando(false);
        return;
      }
    }
    try {
      await api.createSis2000Tarifa(payloadTarifa(cramo, { ...form, ccobertura }));
      onCreada({
        cramo,
        ccobertura,
        ctarifa: form.ctarifa.trim().toUpperCase(),
        nombre: form.xdescripcion_l.trim().toUpperCase(),
        sumaConfig,
      });
    } catch (ex) {
      setAviso(`La cobertura «${nombre}» ya quedó creada; falta su tarifa. Corrige lo que se indica y pulsa «Crear tarifa» (la cobertura no se vuelve a crear).`);
      setErrorServidor({ titulo: 'No se pudo crear la tarifa', error: entenderError(ex, { que: 'una tarifa' }) });
    } finally {
      setGuardando(false);
    }
  }

  const bloqueada = Boolean(coberturaGrabada);
  const boton = guardando
    ? 'Guardando en Sis2000…'
    : bloqueada
      ? 'Crear tarifa'
      : 'Crear cobertura y tarifa';
  /** Abre «Códigos y datos internos» si hay un error ahí (si no, quedaría oculto). */
  const errorEnCodigos =
    (intento || errorServidor !== null) &&
    Boolean(
      errores.ccobertura ||
        errores.ctarifa ||
        errores.xtarifam ||
        errores.cramoint ||
        errores.ccoberturaint ||
        errores.ccontrea ||
        errores.cramorea,
    );
  const nombreCobertura = form.xdescripcion_l.trim().toUpperCase() || 'la cobertura';

  return (
    <form
      onSubmit={pedirConfirmacion}
      noValidate
      className="space-y-5"
      onBlurCapture={(e) => marcarTocado((e.target as HTMLElement).id)}
    >
      {dialogoSalida}
      <p className="text-xs text-muted-foreground">
        Crea en Sis2000 la cobertura de este ramo junto con su tarifa (suma asegurada y tasa o prima). Una cobertura sin
        tarifa vigente no se puede usar en un plan; en personas, incluso desaparece de la póliza al emitir. Los códigos
        se sugieren solos.
      </p>

      {intento && <ResumenErrores errores={resumen} />}
      {aviso && <Alert variant="warning">{aviso}</Alert>}
      {errorServidor && (
        <AlertaError
          titulo={errorServidor.titulo}
          error={errorServidor.error}
          onReintentar={() => void crear()}
          reintentando={guardando}
          idDeCampo={idDePropiedad}
        />
      )}

      <div>
        <h5 className={SUBTITULO}>
          <Shield className="mr-1 inline h-3.5 w-3.5" />
          Cobertura
        </h5>
        <FormGrid>
          <FormField
            label="Nombre de la cobertura *"
            htmlFor="nc-xl"
            span={2}
            hint="Es lo que ve el asegurado en la póliza y lo que se ve al armar planes. Ejemplo: RESPONSABILIDAD CIVIL CONTRACTUAL. Máx. 60."
            error={err('xdescripcion_l')}
          >
            <Input
              id="nc-xl"
              value={form.xdescripcion_l}
              maxLength={60}
              disabled={bloqueada}
              placeholder="RESPONSABILIDAD CIVIL CONTRACTUAL"
              onChange={(e) => cambiar('xdescripcion_l', e.target.value)}
            />
          </FormField>
          <FormField
            label="Nombre corto"
            htmlFor="nc-xc"
            hint="Opcional, para reportes y listados (máx. 15). Si lo dejas vacío se usan los primeros 15 caracteres del nombre."
            error={err('xdescripcion_c')}
          >
            <Input
              id="nc-xc"
              value={form.xdescripcion_c}
              maxLength={15}
              disabled={bloqueada}
              onChange={(e) => cambiar('xdescripcion_c', e.target.value)}
            />
          </FormField>
          <FormField label="Moneda *" hint="Moneda en que se expresan la suma asegurada y la prima de esta cobertura. Ejemplo: USD." error={err('cmoneda')}>
            {monedas.length ? (
              <ComboBuscable
                id="nc-cmoneda"
                ariaLabel="Moneda"
                placeholder="Escribe la moneda…"
                value={form.cmoneda}
                onChange={(v) => cambiar('cmoneda', v)}
                disabled={bloqueada}
                opciones={[
                  ...(!monedas.some((m) => m.codigo === form.cmoneda) && form.cmoneda
                    ? [{ valor: form.cmoneda, etiqueta: form.cmoneda }]
                    : []),
                  ...monedas.map((m) => ({ valor: m.codigo, etiqueta: m.nombre ? `${m.nombre} (${m.codigo})` : m.codigo })),
                ]}
              />
            ) : (
              <Input
                id="nc-cmoneda"
                aria-label="Moneda"
                value={form.cmoneda}
                maxLength={4}
                disabled={bloqueada}
                onChange={(e) => cambiar('cmoneda', e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Abreviatura" htmlFor="nc-xab" hint="Opcional (máx. 5), para listados. Ejemplo: RCC." error={err('xabreviatura')}>
            <Input
              id="nc-xab"
              value={form.xabreviatura}
              maxLength={5}
              disabled={bloqueada}
              onChange={(e) => cambiar('xabreviatura', e.target.value)}
            />
          </FormField>
        </FormGrid>
        <label className={`${ETIQUETA_OPCION} mt-3`}>
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={form.obligatoria}
            onChange={(e) => cambiar('obligatoria', e.target.checked)}
          />
          Obligatoria (va siempre en los planes que la incluyan)
          <InfoTip
            text={'Obligatoria: el asegurado no puede quitarla; va siempre en la póliza. Opcional: puede contratarla o no. Se marca en la tarifa del ramo, no en el plan, así que vale para todos los planes que usen esta cobertura con esta tarifa.\nEn Sis2000: matarifa.bobligatoria'}
          />
        </label>
        <div className="mt-4">
          <CoberturaSumaConfigFields
            idPrefix="nc-suma"
            valores={form}
            errores={{ unidadCalculo: err('unidadCalculo'), etiquetaCuadro: err('etiquetaCuadro') }}
            disabled={Boolean(sumaGrabada)}
            onChange={(cambios) => setForm((prev) => ({ ...prev, ...cambios }))}
          />
        </div>
      </div>

      <div>
        <h5 className={SUBTITULO}>Tarifa: suma asegurada y precio</h5>
        {form.tipoSuma === 'CALCULADA' && (
          <p className="mb-3 text-xs text-muted-foreground">
            Con suma calculada al emitir, la suma máxima y la tasa o prima son opcionales: si las dejas vacías quedan en 0,
            porque la suma llega al emitir.
          </p>
        )}
        <FormGrid>
          <FormField label="Vigente desde *" htmlFor="nc-fdesde" hint="Fecha de referencia de este precio. Ojo: al cotizar y emitir, Sis2000 usa el precio marcado vigente, no mira esta fecha." error={err('fdesde')}>
            <Input id="nc-fdesde" type="date" value={form.fdesde} onChange={(e) => cambiar('fdesde', e.target.value)} />
          </FormField>
          <FormField label="Vigente hasta" htmlFor="nc-fhasta" hint="Vacío o 31/12/2099 si no tiene fin. Es referencia: para dejar de usar el precio hay que inactivarlo." error={err('fhasta')}>
            <Input id="nc-fhasta" type="date" value={form.fhasta} onChange={(e) => cambiar('fhasta', e.target.value)} />
          </FormField>
          <FormField label="Suma asegurada mínima" htmlFor="nc-msumamin" hint="Lo menos que se puede asegurar con esta cobertura. Vacío = 0. Ejemplo: 1000." error={err('msumamin')}>
            <Input
              id="nc-msumamin"
              type="number"
              min={0}
              step="0.01"
              value={form.msumamin}
              onChange={(e) => cambiar('msumamin', e.target.value)}
            />
          </FormField>
          <FormField
            label={form.tipoSuma === 'CALCULADA' ? 'Suma asegurada máxima' : 'Suma asegurada máxima *'}
            htmlFor="nc-msumamax"
            hint="Lo más que se puede asegurar. Mayor a 0, salvo con suma calculada al emitir. Ejemplo: 50000."
            error={err('msumamax')}
          >
            <Input
              id="nc-msumamax"
              type="number"
              min={0}
              step="0.01"
              value={form.msumamax}
              onChange={(e) => cambiar('msumamax', e.target.value)}
            />
          </FormField>
        </FormGrid>
        <p className="mb-2 mt-4 text-[0.78rem] font-bold tracking-wide text-slate-600">¿Cómo se cobra? (elige una)</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cómo se cobra">
          <label className={ETIQUETA_OPCION}>
            <input
              type="radio"
              name="nc-modo"
              className="h-4 w-4 accent-primary"
              checked={form.modo === 'tasa'}
              onChange={() => cambiar('modo', 'tasa')}
            />
            Tasa % sobre la suma asegurada
          </label>
          <label className={ETIQUETA_OPCION}>
            <input
              type="radio"
              name="nc-modo"
              className="h-4 w-4 accent-primary"
              checked={form.modo === 'prima'}
              onChange={() => cambiar('modo', 'prima')}
            />
            Prima fija
          </label>
        </div>
        <FormGrid className="mt-3">
          {form.modo === 'tasa' ? (
            <FormField
              label={form.tipoSuma === 'CALCULADA' ? 'Tasa %' : 'Tasa % *'}
              htmlFor="nc-pprima"
              hint="Porcentaje de la suma asegurada que se cobra como prima anual: 0.5 = 0,5 % (con 10.000 de suma, 50 de prima). Hasta 6 decimales."
              error={err('pprima')}
            >
              <Input
                id="nc-pprima"
                type="number"
                min={0}
                step="0.000001"
                value={form.pprima}
                onChange={(e) => cambiar('pprima', e.target.value)}
              />
            </FormField>
          ) : (
            <FormField
              label={form.tipoSuma === 'CALCULADA' ? 'Prima fija' : 'Prima fija *'}
              htmlFor="nc-mprima"
              hint="Monto anual fijo que se cobra sin importar la suma asegurada. Ejemplo: 25."
              error={err('mprima')}
            >
              <Input
                id="nc-mprima"
                type="number"
                min={0}
                step="0.01"
                value={form.mprima}
                onChange={(e) => cambiar('mprima', e.target.value)}
              />
            </FormField>
          )}
        </FormGrid>
        <p className="mb-2 mt-4 text-[0.78rem] font-bold tracking-wide text-slate-600">Deducible (opcional)</p>
        <DeducibleCampos
          idBase="nc-ded"
          valor={form.deducible}
          onChange={(v) => cambiar('deducible', v)}
          moneda={form.cmoneda || '$'}
          deshabilitado={bloqueada}
        />
        {err('deducible') && <p className="mt-1 text-xs text-red-700">{err('deducible')}</p>}
        <p className="mt-1 text-[11px] text-slate-500">
          Parte del siniestro que asume el asegurado. Se guarda en la tarifa y es el que toma la emisión. Si el servidor no
          tiene habilitados los deducibles, déjalo en «Sin deducible» y agrégalo después desde la ficha del plan.
        </p>
      </div>

      <DetallesTecnicos titulo="Códigos y datos internos (opcional)" abierto={errorEnCodigos}>
        <p>Se sugieren solos. Cámbialos solo si Técnica o Reaseguro te lo piden.</p>
        <FormGrid>
          <FormField
            label="Código de la cobertura *"
            htmlFor="nc-ccobertura"
            hint="Hasta 4 letras o números, único en el ramo. Se sugiere el siguiente libre."
            error={err('ccobertura')}
          >
            <Input
              id="nc-ccobertura"
              value={form.ccobertura}
              maxLength={4}
              disabled={bloqueada}
              onChange={(e) => cambiar('ccobertura', e.target.value)}
            />
          </FormField>
          <FormField label="Código de la tarifa *" htmlFor="nc-ctarifa" hint="Lo normal es 1. Una misma cobertura puede tener más de una tarifa; el plan elige cuál usa." error={err('ctarifa')}>
            <Input id="nc-ctarifa" value={form.ctarifa} maxLength={4} onChange={(e) => cambiar('ctarifa', e.target.value)} />
          </FormField>
          <FormField
            label="Nombre interno de la tarifa"
            htmlFor="nc-xtarifam"
            hint={`Máx. 15. Si lo dejas vacío: «${nombreCortoPorDefecto(form) || '—'}».`}
            error={err('xtarifam')}
          >
            <Input
              id="nc-xtarifam"
              value={form.xtarifam}
              maxLength={15}
              onChange={(e) => cambiar('xtarifam', e.target.value)}
            />
          </FormField>
          <FormField
            label="Copiar datos internos de"
            htmlFor="nc-basada"
            hint="Elige una cobertura parecida del ramo para copiar su ramo y cobertura internos (la equivalencia que usan los cálculos)."
          >
            <ComboBuscable
              id="nc-basada"
              ariaLabel="Copiar datos internos de"
              placeholder="Escribe la cobertura…"
              value={form.basadaEn || SIN_BASE}
              onChange={elegirBase}
              disabled={bloqueada}
              opciones={[
                { valor: SIN_BASE, etiqueta: 'Ninguna (dejar vacíos)' },
                ...conCodigo.map((c) => {
                  const cod = texto(c.ccobertura);
                  return { valor: cod, etiqueta: `${texto(c.xdescripcion_l) || 'Sin nombre'} (${cod})` };
                }),
              ]}
            />
          </FormField>
          <FormField
            label="Ramo interno"
            htmlFor="nc-cramoint"
            tooltip={'Ramo de referencia al que pertenece la cobertura interna (ver «Cobertura interna»). Normalmente se copia de una cobertura parecida.\nEn Sis2000: macoberturas.cramoint'}
            error={err('cramoint')}
          >
            <Input
              id="nc-cramoint"
              inputMode="numeric"
              value={form.cramoint}
              disabled={bloqueada}
              onChange={(e) => cambiar('cramoint', e.target.value)}
            />
          </FormField>
          <FormField
            label="Cobertura interna"
            htmlFor="nc-ccobint"
            tooltip={'Dice a qué cobertura «estándar» equivale esta. En auto es clave: si no apunta a la equivalente del ramo 18, el cálculo usa la fórmula general. Ejemplo: 15 = Daños a personas y 17 = Daños a cosas (RCV), que se cobran completas en la 1ª cuota.\nEn Sis2000: macoberturas.ccoberturaint'}
            error={err('ccoberturaint')}
          >
            <Input
              id="nc-ccobint"
              inputMode="numeric"
              value={form.ccoberturaint}
              disabled={bloqueada}
              onChange={(e) => cambiar('ccoberturaint', e.target.value)}
            />
          </FormField>
          <ReaseguroListas />
          <FormField
            label="Contrato de reaseguro *"
            htmlFor="nc-ccontrea"
            hint="Obligatorio (lo da Reaseguro); se sugiere el que más usa el ramo. Sin él la póliza no se puede emitir."
            error={err('ccontrea')}
          >
            <Input
              id="nc-ccontrea"
              inputMode="numeric"
              list={LISTA_CONTRATOS_REASEGURO}
              value={form.ccontrea}
              disabled={bloqueada}
              onChange={(e) => cambiar('ccontrea', e.target.value)}
            />
          </FormField>
          <FormField label="Ramo de reaseguro *" htmlFor="nc-cramorea" hint="Obligatorio; va junto con el contrato de reaseguro." error={err('cramorea')}>
            <Input
              id="nc-cramorea"
              inputMode="numeric"
              list={LISTA_RAMOS_REASEGURO}
              value={form.cramorea}
              disabled={bloqueada}
              onChange={(e) => cambiar('cramorea', e.target.value)}
            />
          </FormField>
        </FormGrid>
        <p>Se graba en macoberturas, matarifa y matarifa_d (nest-api v1/configurador/coberturas y /tarifas).</p>
      </DetallesTecnicos>

      <div className="flex flex-wrap justify-end gap-2">
        {onCancelar && (
          <Button type="button" variant="outline" onClick={onCancelar} disabled={guardando}>
            {bloqueada ? 'Cerrar' : 'Cancelar'}
          </Button>
        )}
        <Button type="submit" disabled={guardando}>
          <Plus className="h-4 w-4" />
          {boton}
        </Button>
      </div>

      {confirmando && (
        <ConfirmarDialog
          titulo={bloqueada ? '¿Crear la tarifa en Sis2000?' : '¿Crear la cobertura en Sis2000?'}
          confirmar={bloqueada ? 'Sí, crear la tarifa' : 'Sí, crear cobertura y tarifa'}
          ocupado={guardando}
          onCancelar={() => setConfirmando(false)}
          onConfirmar={() => void crear()}
        >
          <p>
            {bloqueada ? (
              <>Se va a crear la tarifa de «{nombreCobertura}».</>
            ) : (
              <>
                Se va a crear la cobertura <strong>«{nombreCobertura}»</strong> en este ramo
                {form.obligatoria ? ' (obligatoria)' : ''} con su tarifa vigente desde {form.fdesde || '—'}:
              </>
            )}
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-xs">
            {form.tipoSuma === 'CALCULADA' ? (
              <li>Suma asegurada calculada al emitir.</li>
            ) : (
              <li>
                Suma asegurada de {form.cmoneda} {form.msumamin.trim() || '0'} a {form.msumamax.trim() || '0'}.
              </li>
            )}
            <li>
              {form.modo === 'tasa'
                ? `Tasa ${form.pprima.trim() || '0'} % sobre la suma asegurada.`
                : `Prima fija ${form.cmoneda} ${form.mprima.trim() || '0'}.`}
            </li>
            {form.deducible.bfraded && <li>{textoDeducible(form.deducible, form.cmoneda)}.</li>}
          </ul>
          <p className="text-xs text-muted-foreground">Las coberturas no se borran desde el configurador (se pueden inactivar).</p>
        </ConfirmarDialog>
      )}
    </form>
  );
}
