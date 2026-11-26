import { useEffect, useState } from 'react';
import { Building2, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import {
  ALTA_CLIENTE_VACIA,
  ALTA_PROVEEDOR_VACIA,
  altaClienteDesdeBusqueda,
  altaClienteToPayload,
  clienteCreadoABusqueda,
  TIPOS_DOCUMENTO_EMPRESA,
  validarAltaClienteForm,
  type AltaClienteForm,
  altaProveedorToPayload,
  catalogoDesdeAlta,
  mensajeAltaProveedor,
  OTRO_TIPO,
  validarAltaProveedorForm,
  errorRifBusqueda,
  limpiarRifEntrada,
  limpiarCodigo1,
  type AltaProveedorForm,
  type ClienteBusqueda,
  type ProveedorCatalogo,
  type TipoServicioCatalogo,
} from '@/lib/sis2000-proveedores';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface Props {
  monedas: Array<{ codigo: string; nombre: string }>;
  onCerrar: () => void;
  /** Proveedor creado, ya como entrada del catálogo (con su clave) para dejarlo elegido. */
  onCreado: (p: ProveedorCatalogo) => void;
}

/**
 * Registro del servicio de una empresa (p. ej. la grúa) en el catálogo de Sis2000 (maclient_prov). En Sis2000 el proveedor
 * es un servicio de una empresa cliente: se busca por RIF y, si no existe, se crea ahí mismo como cliente (J, G o C).
 * Después se asocia al plan como cualquier otro.
 */
export function AltaProveedorCatalogoDialog({ monedas, onCerrar, onCreado }: Props) {
  const [form, setForm] = useState<AltaProveedorForm>(ALTA_PROVEEDOR_VACIA);
  const [rif, setRif] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<ClienteBusqueda[] | null>(null);
  const [cliente, setCliente] = useState<ClienteBusqueda | null>(null);
  const [tipos, setTipos] = useState<TipoServicioCatalogo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [creandoCliente, setCreandoCliente] = useState(false);
  const [formCli, setFormCli] = useState<AltaClienteForm>(ALTA_CLIENTE_VACIA);
  const [intentoCli, setIntentoCli] = useState(false);
  const [guardandoCli, setGuardandoCli] = useState(false);
  const [estados, setEstados] = useState<Array<{ cestado: number; xdescripcion: string }>>([]);
  const [ciudades, setCiudades] = useState<Array<{ cciudad: number; xdescripcion: string }>>([]);

  useEffect(() => {
    api
      .listSis2000TiposServicio()
      .then((t) => setTipos(Array.isArray(t) ? t : []))
      .catch(() => setTipos([]));
  }, []);

  const errorRif = errorRifBusqueda(rif);
  const faltanCli = validarAltaClienteForm(formCli);
  const faltan = validarAltaProveedorForm(form);

  async function buscar() {
    if (!rif.trim() || errorRif) return;
    setBuscando(true);
    setError(null);
    setResultados(null);
    try {
      setResultados(await api.buscarSis2000Clientes(rif.trim()));
    } catch (e) {
      setError(mensajeError(e, 'No se pudo buscar la empresa.'));
    } finally {
      setBuscando(false);
    }
  }

  function elegirCliente(c: ClienteBusqueda) {
    setCliente(c);
    setForm((f) => ({ ...f, cci_rif: String(c.cci_rif) }));
    setResultados(null);
  }

  function abrirCrearCliente() {
    setFormCli(altaClienteDesdeBusqueda(rif));
    setIntentoCli(false);
    setCreandoCliente(true);
    setError(null);
    if (!estados.length) {
      api
        .listSis2000Estados()
        .then((e) => setEstados(Array.isArray(e) ? e : []))
        .catch(() => setEstados([]));
    }
  }

  function cambiarEstado(valor: string) {
    setFormCli((f) => ({ ...f, cestado: valor, cciudad: '' }));
    setCiudades([]);
    if (!valor) return;
    api
      .listSis2000Ciudades(Number(valor))
      .then((c) => setCiudades(Array.isArray(c) ? c : []))
      .catch(() => setCiudades([]));
  }

  async function crearCliente() {
    setIntentoCli(true);
    if (faltanCli.length) return;
    setGuardandoCli(true);
    setError(null);
    try {
      const creado = await api.crearSis2000Cliente(altaClienteToPayload(formCli));
      elegirCliente(clienteCreadoABusqueda(creado, formCli));
      setCreandoCliente(false);
    } catch (e) {
      if ((e as { status?: number } | null)?.status === 409) {
        // Ya existe (o la bandera de escritura está apagada): se vuelve a buscar para elegirla de la lista.
        const texto = `${formCli.tipo_documento}-${formCli.rif.trim()}`;
        setRif(texto);
        try {
          const lista = await api.buscarSis2000Clientes(texto);
          if (lista.length) {
            setResultados(lista);
            setCreandoCliente(false);
            setError('La empresa ya existe como cliente: elígela de la lista.');
            return;
          }
        } catch {
          // Sin búsqueda: se muestra el mensaje del servidor.
        }
      }
      setError(mensajeError(e, 'No se pudo crear la empresa como cliente.'));
    } finally {
      setGuardandoCli(false);
    }
  }

  async function crear() {
    const errores = validarAltaProveedorForm(form);
    if (errores.length) {
      setError(errores.join(' '));
      return;
    }
    if (!cliente) return;
    setGuardando(true);
    setError(null);
    try {
      const creado = await api.crearSis2000ProveedorCatalogo(altaProveedorToPayload(form));
      onCreado(catalogoDesdeAlta(cliente, creado));
    } catch (e) {
      setError(mensajeError(e, 'No se pudo registrar el servicio en el catálogo.'));
    } finally {
      setGuardando(false);
    }
  }

  const campoTexto = (k: keyof AltaProveedorForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Registrar el servicio de una empresa"
        className="max-h-full w-full max-w-xl space-y-3 overflow-y-auto rounded-xl bg-white p-5 text-xs shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">Registrar el servicio de una empresa</h2>
            <p className="text-muted-foreground">
              En Sis2000 el proveedor es un servicio de una empresa cliente. Busca la empresa por su RIF (o créala como cliente
              si no existe), registra su servicio (grúa, clínica, asistencia…) y luego lo asocias al plan.
            </p>
          </div>
          <button type="button" aria-label="Cerrar" className="rounded p-1 hover:bg-muted" onClick={onCerrar}>
            <X className="h-4 w-4" />
          </button>
        </header>

        {error && <Alert variant="warning">{error}</Alert>}

        <div className="space-y-1.5">
          <Label htmlFor="alta-rif">Empresa (RIF)</Label>
          {cliente ? (
            <p>
              <strong>{cliente.xcliente}</strong> ({cliente.cid || cliente.cci_rif}){' '}
              <button type="button" className="underline" onClick={() => setCliente(null)}>
                cambiar
              </button>
            </p>
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  id="alta-rif"
                  placeholder="Ej.: J-12345678-9"
                  value={rif}
                  maxLength={12}
                  aria-invalid={Boolean(errorRif)}
                  onChange={(e) => {
                    setRif(limpiarRifEntrada(e.target.value));
                    setResultados(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void buscar();
                    }
                  }}
                />
                <Button type="button" size="sm" variant="outline" disabled={buscando || !rif.trim() || Boolean(errorRif)} onClick={() => void buscar()}>
                  <Search className="h-3.5 w-3.5" />
                  Buscar
                </Button>
              </div>
              {errorRif && <p className="text-red-600">{errorRif}</p>}
              {!errorRif && !resultados && <p className="text-muted-foreground">Escribe el RIF y pulsa «Buscar»; luego elige la empresa de la lista.</p>}
              {resultados && resultados.length === 0 && (
                <div className="space-y-1.5">
                  <p className="text-amber-700">No hay una empresa con ese RIF como cliente en Sis2000.</p>
                  {!creandoCliente && (
                    <Button type="button" size="sm" variant="outline" onClick={abrirCrearCliente}>
                      <Building2 className="h-3.5 w-3.5" />
                      Crear la empresa como cliente
                    </Button>
                  )}
                </div>
              )}
              {resultados && resultados.length > 0 && (
                <ul className="divide-y divide-border/50 rounded-lg border border-border/50">
                  {resultados.map((c) => (
                    <li key={c.cci_rif}>
                      <button type="button" className="w-full p-2 text-left hover:bg-muted/50" onClick={() => elegirCliente(c)}>
                        {c.xcliente}
                        <span className="block text-muted-foreground">
                          {c.cid || c.cci_rif}
                          {c.tipo_documento ? ` · ${c.tipo_documento}` : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {creandoCliente && !cliente && (
          <fieldset className="space-y-2 rounded-lg border border-border p-3" data-testid="crear-cliente">
            <legend className="px-1 font-semibold">Nueva empresa cliente</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <Label htmlFor="cli-tipo">Tipo de documento</Label>
                <select
                  id="cli-tipo"
                  className="h-10 w-full rounded-md border border-border bg-background px-2"
                  value={formCli.tipo_documento}
                  onChange={(e) => setFormCli((f) => ({ ...f, tipo_documento: e.target.value }))}
                >
                  {TIPOS_DOCUMENTO_EMPRESA.map((t) => (
                    <option key={t.codigo} value={t.codigo}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="cli-rif">Número de RIF (con el dígito verificador)</Label>
                <Input
                  id="cli-rif"
                  inputMode="numeric"
                  placeholder="Ej.: 123456789"
                  maxLength={11}
                  value={formCli.rif}
                  onChange={(e) => setFormCli((f) => ({ ...f, rif: e.target.value.replace(/\D/g, '') }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="cli-nombre">Razón social</Label>
              <Input id="cli-nombre" maxLength={250} value={formCli.xcliente} onChange={(e) => setFormCli((f) => ({ ...f, xcliente: e.target.value }))} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor="cli-correo">Correo</Label>
                <Input id="cli-correo" type="email" maxLength={100} value={formCli.xcorreo} onChange={(e) => setFormCli((f) => ({ ...f, xcorreo: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="cli-tel">Teléfono (10 u 11 dígitos)</Label>
                <Input id="cli-tel" inputMode="tel" maxLength={14} value={formCli.xtelefono} onChange={(e) => setFormCli((f) => ({ ...f, xtelefono: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="cli-estado">Estado</Label>
                <select id="cli-estado" className="h-10 w-full rounded-md border border-border bg-background px-2" value={formCli.cestado} onChange={(e) => cambiarEstado(e.target.value)}>
                  <option value="">Sin indicar</option>
                  {estados.map((e) => (
                    <option key={e.cestado} value={e.cestado}>
                      {e.xdescripcion}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="cli-ciudad">Ciudad</Label>
                <select
                  id="cli-ciudad"
                  className="h-10 w-full rounded-md border border-border bg-background px-2"
                  value={formCli.cciudad}
                  disabled={!formCli.cestado}
                  onChange={(e) => setFormCli((f) => ({ ...f, cciudad: e.target.value }))}
                >
                  <option value="">Sin indicar</option>
                  {ciudades.map((c) => (
                    <option key={c.cciudad} value={c.cciudad}>
                      {c.xdescripcion}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="cli-dir">Dirección</Label>
              <Input id="cli-dir" maxLength={250} value={formCli.xdireccion} onChange={(e) => setFormCli((f) => ({ ...f, xdireccion: e.target.value }))} />
            </div>
            {intentoCli && faltanCli.length > 0 && (
              <ul className="list-disc pl-4 text-red-600">
                {faltanCli.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setCreandoCliente(false)}>
                No crear
              </Button>
              <Button type="button" size="sm" disabled={guardandoCli} onClick={() => void crearCliente()}>
                {guardandoCli ? 'Creando…' : 'Crear empresa y seguir'}
              </Button>
            </div>
          </fieldset>
        )}

        <div>
          <Label htmlFor="alta-desc">Descripción del servicio</Label>
          <Input
            id="alta-desc"
            placeholder="Ej.: Grúa urbana 25 km"
            maxLength={120}
            value={form.xdescripcion}
            onChange={(e) => campoTexto('xdescripcion')(e.target.value)}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label htmlFor="alta-tipo">Tipo de servicio</Label>
            <select
              id="alta-tipo"
              className="h-10 w-full rounded-md border border-border bg-background px-2"
              value={form.tipo}
              onChange={(e) => campoTexto('tipo')(e.target.value)}
            >
              <option value="">Elige…</option>
              {tipos.map((t) => (
                <option key={t.itiposerv} value={t.itiposerv}>
                  {t.itiposerv} ({t.cantidad} en el catálogo)
                </option>
              ))}
              <option value={OTRO_TIPO}>Otro…</option>
            </select>
          </div>
          {form.tipo === OTRO_TIPO && (
            <div>
              <Label htmlFor="alta-tipo-otro">Código del tipo (1 carácter)</Label>
              <Input
                id="alta-tipo-otro"
                maxLength={1}
                value={form.tipoOtro}
                onChange={(e) => campoTexto('tipoOtro')(limpiarCodigo1(e.target.value))}
              />
              <p className="mt-1 text-muted-foreground">Código que La Mundial usa para este servicio.</p>
            </div>
          )}
          <div>
            <Label htmlFor="alta-costo">Costo</Label>
            <Input
              id="alta-costo"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={form.mcostoext}
              onChange={(e) => campoTexto('mcostoext')(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="alta-moneda">Moneda</Label>
            {monedas.length ? (
              <select
                id="alta-moneda"
                className={cn('h-10 w-full rounded-md border border-border bg-background px-2')}
                value={form.cmoneda}
                onChange={(e) => campoTexto('cmoneda')(e.target.value)}
              >
                {(monedas.some((m) => m.codigo === form.cmoneda) ? monedas : [{ codigo: form.cmoneda, nombre: '' }, ...monedas]).map((m) => (
                  <option key={m.codigo} value={m.codigo}>
                    {m.nombre ? `${m.codigo} · ${m.nombre}` : m.codigo}
                  </option>
                ))}
              </select>
            ) : (
              <Input id="alta-moneda" maxLength={4} value={form.cmoneda} onChange={(e) => campoTexto('cmoneda')(e.target.value)} />
            )}
          </div>
          <div>
            <Label htmlFor="alta-modalidad">Modalidad (opcional, 1 carácter)</Label>
            <Input
              id="alta-modalidad"
              maxLength={1}
              value={form.imodalidad}
              onChange={(e) => campoTexto('imodalidad')(limpiarCodigo1(e.target.value))}
            />
          </div>
        </div>

        {faltan.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-900">
            <p className="font-semibold">Para crear el proveedor falta:</p>
            <ul className="list-disc pl-4">
              {faltan.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" size="sm" variant="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="button" size="sm" disabled={guardando || !cliente || faltan.length > 0} onClick={() => void crear()}>
            {guardando ? 'Creando…' : 'Registrar servicio'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Mensaje en español del error (nest-api ya responde en español; si no, uno según el código HTTP). */
function mensajeError(e: unknown, respaldo: string): string {
  const err = (e ?? {}) as { status?: number; message?: string };
  const detalle = typeof err.message === 'string' ? err.message : '';
  // Un texto técnico (HTML, "Failed to fetch", JSON) no sirve al usuario: se usa el mensaje del código HTTP.
  const util = detalle && !/^(failed to fetch|network|<|\{)/i.test(detalle.trim()) ? detalle : '';
  return mensajeAltaProveedor(err.status, util) || respaldo;
}
