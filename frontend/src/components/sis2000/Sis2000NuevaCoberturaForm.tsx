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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ETIQUETA_OPCION =
  'inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-xs font-medium';
const SUBTITULO = 'mb-3 mt-1 text-xs font-bold uppercase tracking-wide text-slate-500';
const SIN_BASE = '__ninguna__';

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
  const [error, setError] = useState<string | null>(null);
  /** Código de la cobertura ya grabada cuando falló la tarifa (se reintenta solo la tarifa). */
  const [coberturaGrabada, setCoberturaGrabada] = useState<string | null>(null);
  /** Configuración de suma ya guardada en el configurador (se reintenta si falló). */
  const [sumaGrabada, setSumaGrabada] = useState<CoberturaSumaConfig | null>(null);
  /** Pide confirmación antes de escribir en Sis2000. */
  const [confirmando, setConfirmando] = useState(false);

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
  const err = (campo: keyof NuevaCoberturaForm) => (intento ? errores[campo] : undefined);

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
    setError(null);
    if (hayErrores) {
      setError('Revisa los campos marcados en rojo (algunos pueden estar en «Códigos y datos internos»).');
      return;
    }
    setConfirmando(true);
  }

  async function crear() {
    setConfirmando(false);
    setError(null);
    setGuardando(true);
    const ccobertura = coberturaGrabada ?? form.ccobertura.trim().toUpperCase();
    try {
      if (!coberturaGrabada) {
        await api.createSis2000Cobertura(payloadCobertura(cramo, form));
        setCoberturaGrabada(ccobertura);
      }
    } catch (ex) {
      setError(
        `No se pudo crear la cobertura: ${ex instanceof Error ? ex.message : 'error desconocido'}`,
      );
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
        setError(
          `La cobertura «${form.xdescripcion_l.trim().toUpperCase() || ccobertura}» quedó creada, pero no se pudo guardar «Suma calculada al emitir»: ${
            ex instanceof Error ? ex.message : 'error desconocido'
          }. Pulsa «Crear tarifa» para reintentar.`,
        );
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
      setError(
        `La cobertura «${form.xdescripcion_l.trim().toUpperCase() || ccobertura}» quedó creada, pero su tarifa no: ${
          ex instanceof Error ? ex.message : 'error desconocido'
        }. Corrige los datos de la tarifa y pulsa «Crear tarifa».`,
      );
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
    intento &&
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
    <form onSubmit={pedirConfirmacion} noValidate className="space-y-5">
      <p className="text-xs text-muted-foreground">
        Se crea en Sis2000 la cobertura en este ramo junto con su tarifa: suma asegurada y tasa o prima vigentes. Sin
        tarifa vigente una cobertura no se puede usar en un plan. Los códigos se sugieren solos.
      </p>

      {error && <Alert variant={bloqueada ? 'warning' : 'error'}>{error}</Alert>}

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
            hint="Es lo que se ve en la póliza. Ejemplo: RESPONSABILIDAD CIVIL CONTRACTUAL. Máx. 60."
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
            hint="Opcional, para reportes (máx. 15). Vacío = primeros 15 caracteres del nombre."
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
          <FormField label="Moneda *" hint="Moneda de la suma asegurada y la prima." error={err('cmoneda')}>
            {monedas.length ? (
              <Select
                value={form.cmoneda}
                onValueChange={(v) => cambiar('cmoneda', v)}
                disabled={bloqueada}
              >
                <SelectTrigger aria-label="Moneda">
                  <SelectValue placeholder="Elige la moneda…" />
                </SelectTrigger>
                <SelectContent>
                  {!monedas.some((m) => m.codigo === form.cmoneda) && form.cmoneda && (
                    <SelectItem value={form.cmoneda}>{form.cmoneda}</SelectItem>
                  )}
                  {monedas.map((m) => (
                    <SelectItem key={m.codigo} value={m.codigo}>
                      {m.nombre ? `${m.nombre} (${m.codigo})` : m.codigo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                aria-label="Moneda"
                value={form.cmoneda}
                maxLength={4}
                disabled={bloqueada}
                onChange={(e) => cambiar('cmoneda', e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Abreviatura" htmlFor="nc-xab" hint="Opcional (máx. 5). Ejemplo: RCC." error={err('xabreviatura')}>
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
            Con suma calculada al emitir, la suma máxima y la tasa o prima son opcionales (quedan en 0 si las dejas
            vacías).
          </p>
        )}
        <FormGrid>
          <FormField label="Vigente desde *" htmlFor="nc-fdesde" hint="Desde cuándo vale este precio." error={err('fdesde')}>
            <Input id="nc-fdesde" type="date" value={form.fdesde} onChange={(e) => cambiar('fdesde', e.target.value)} />
          </FormField>
          <FormField label="Vigente hasta" htmlFor="nc-fhasta" hint="Vacío o 31/12/2099 si no tiene fin." error={err('fhasta')}>
            <Input id="nc-fhasta" type="date" value={form.fhasta} onChange={(e) => cambiar('fhasta', e.target.value)} />
          </FormField>
          <FormField label="Suma asegurada mínima" htmlFor="nc-msumamin" hint="Vacío = 0. Ejemplo: 1000." error={err('msumamin')}>
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
            hint="Mayor a 0, salvo con suma calculada al emitir. Ejemplo: 50000."
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
              hint="0.5 = 0,5 % de la suma asegurada (hasta 6 decimales)."
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
              hint="Monto fijo, sin importar la suma asegurada. Ejemplo: 25."
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
      </div>

      <DetallesTecnicos titulo="Códigos y datos internos (opcional)" abierto={errorEnCodigos}>
        <p>Se sugieren solos. Cámbialos solo si Técnico o Reaseguro te lo piden.</p>
        <FormGrid>
          <FormField
            label="Código de la cobertura *"
            htmlFor="nc-ccobertura"
            hint="Hasta 4 letras o números; se sugiere el siguiente libre del ramo."
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
          <FormField label="Código de la tarifa *" htmlFor="nc-ctarifa" hint="Lo normal es 1." error={err('ctarifa')}>
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
          <FormField label="Copiar datos internos de" hint="Toma el ramo y la cobertura internos de una cobertura parecida del ramo.">
            <Select value={form.basadaEn || SIN_BASE} onValueChange={elegirBase} disabled={bloqueada}>
              <SelectTrigger aria-label="Copiar datos internos de">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={SIN_BASE}>Ninguna (dejar vacíos)</SelectItem>
                {conCodigo.map((c) => {
                  const cod = texto(c.ccobertura);
                  return (
                    <SelectItem key={cod} value={cod}>
                      {texto(c.xdescripcion_l) || 'Sin nombre'} ({cod})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Ramo interno" htmlFor="nc-cramoint" error={err('cramoint')}>
            <Input
              id="nc-cramoint"
              inputMode="numeric"
              value={form.cramoint}
              disabled={bloqueada}
              onChange={(e) => cambiar('cramoint', e.target.value)}
            />
          </FormField>
          <FormField label="Cobertura interna" htmlFor="nc-ccobint" error={err('ccoberturaint')}>
            <Input
              id="nc-ccobint"
              inputMode="numeric"
              value={form.ccoberturaint}
              disabled={bloqueada}
              onChange={(e) => cambiar('ccoberturaint', e.target.value)}
            />
          </FormField>
          <FormField
            label="Contrato de reaseguro"
            htmlFor="nc-ccontrea"
            hint="Opcional. Pídelo a Reaseguro si la cobertura se cede."
            error={err('ccontrea')}
          >
            <Input
              id="nc-ccontrea"
              inputMode="numeric"
              value={form.ccontrea}
              disabled={bloqueada}
              onChange={(e) => cambiar('ccontrea', e.target.value)}
            />
          </FormField>
          <FormField label="Ramo de reaseguro" htmlFor="nc-cramorea" hint="Opcional." error={err('cramorea')}>
            <Input
              id="nc-cramorea"
              inputMode="numeric"
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
          </ul>
          <p className="text-xs text-muted-foreground">Las coberturas no se borran desde el configurador (se pueden inactivar).</p>
        </ConfirmarDialog>
      )}
    </form>
  );
}
