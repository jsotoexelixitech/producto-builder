import { useCallback, useEffect, useState, type InputHTMLAttributes } from 'react';
import { Plus, Truck } from 'lucide-react';
import { api } from '@/lib/api';
import {
  clavesDelProveedor,
  PROVEEDOR_FORM_VACIO,
  proveedorFormToPayload,
  validarProveedorForm,
  type ProveedorCatalogo,
  type ProveedoresPlanRespuesta,
  type ProveedorPlan,
  type ProveedorPlanForm,
} from '@/lib/sis2000-proveedores';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BuscadorConLista } from '@/components/ui/lista-flotante';
import { SectionPanel } from '@/components/ui/section-panel';
import { cn } from '@/lib/utils';

interface Props {
  /**
   * "cramo-cplan". null = el plan todavía no existe: los proveedores elegidos quedan pendientes y se agregan solos
   * en cuanto llega el planId (al crear el plan en la misma pantalla).
   */
  planId: string | null;
  /** Se llama después de agregar, editar o dar de baja (p. ej. para recargar el historial). */
  onCambio?: () => void;
  className?: string;
}

const hoy = () => new Date().toISOString().slice(0, 10);

function estadoProveedor(p: ProveedorPlan): { texto: string; clase: string } {
  if (p.vigente) return { texto: 'Vigente', clase: 'bg-emerald-50 text-emerald-800' };
  if (p.fdesde > hoy()) return { texto: 'Desde ' + p.fdesde, clase: 'bg-sky-50 text-sky-800' };
  return { texto: 'De baja', clase: 'bg-slate-100 text-slate-700' };
}

const costo = (p: ProveedorPlan) =>
  [
    p.mcostoext ? `${Number(p.mcostoext).toLocaleString('es-VE')} ${p.cmoneda ?? '$'}` : null,
    p.mcosto ? `Bs ${Number(p.mcosto).toLocaleString('es-VE')}` : null,
  ]
    .filter(Boolean)
    .join(' · ') || '—';

/**
 * Proveedores del plan (maplprov_per). Se asignan al plan y aplican a todas sus coberturas; al emitir pólizas de
 * personas, los vigentes se registran en cada póliza. Baja = cerrar la vigencia, nunca borrar.
 */
export function ProveedoresPlanPanel({ planId, onCambio, className }: Props) {
  const [datos, setDatos] = useState<ProveedoresPlanRespuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [verBajas, setVerBajas] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [motivo, setMotivo] = useState('');

  const [q, setQ] = useState('');
  const [catalogo, setCatalogo] = useState<ProveedorCatalogo[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [listaFallo, setListaFallo] = useState(false);
  const [monedas, setMonedas] = useState<Array<{ codigo: string; nombre: string }>>([]);
  const [elegido, setElegido] = useState<ProveedorCatalogo | null>(null);
  const [form, setForm] = useState<ProveedorPlanForm>(PROVEEDOR_FORM_VACIO);
  const [editando, setEditando] = useState<string | null>(null);
  const [edicion, setEdicion] = useState({ fhasta: '', itiposerv: '', mcostoext: '', mcosto: '', cmoneda: '' });

  /** Elegidos antes de que exista el plan; se agregan al crearlo. */
  const [pendientes, setPendientes] = useState<Array<{ form: ProveedorPlanForm; nombre: string }>>([]);

  const cargar = useCallback(() => {
    if (!planId) return;
    setError(null);
    api
      .listSis2000PlanProveedores(planId)
      .then(setDatos)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron leer los proveedores del plan'));
  }, [planId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Plan recién creado: agrega los pendientes (solo alta en maplprov_per); los que fallen se informan para agregarlos a mano.
  useEffect(() => {
    if (!planId || !pendientes.length) return;
    const lote = pendientes;
    setPendientes([]);
    setTrabajando(true);
    void (async () => {
      const fallidos: typeof lote = [];
      const errores: string[] = [];
      for (const p of lote) {
        try {
          await api.agregarSis2000PlanProveedor(planId, proveedorFormToPayload(p.form));
        } catch (e) {
          fallidos.push(p);
          errores.push(`${p.nombre}: ${e instanceof Error ? e.message : 'no se pudo agregar'}`);
        }
      }
      setTrabajando(false);
      if (lote.length > fallidos.length) setOk(`${lote.length - fallidos.length} proveedor(es) agregado(s) al plan.`);
      if (errores.length) {
        setError(
          `El plan se creó, pero no se pudieron agregar ${fallidos.length} proveedor(es); agrégalos abajo: ${errores.join(' · ')}`,
        );
      }
      cargar();
      onCambio?.();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  /** Sin plan todavía se puede elegir (queda pendiente); con plan, según la bandera de nest-api. */
  const escribir = !planId || (datos?.escritura_habilitada === true && !datos?.columna_cobertura);

  // Sin texto, nest-api devuelve el listado inicial (TOP 60 filas por nombre); con texto filtra por nombre o RIF.
  useEffect(() => {
    if (!escribir) return;
    const t = setTimeout(() => {
      setBuscando(true);
      api
        .listSis2000Proveedores(q.trim())
        .then((rows) => {
          setCatalogo(rows ?? []);
          setListaFallo(false);
        })
        .catch(() => {
          setCatalogo([]);
          setListaFallo(true);
        })
        .finally(() => setBuscando(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, escribir]);

  // Monedas: mismo catálogo que «Moneda (cmoneda)» de Datos del plan.
  useEffect(() => {
    api
      .listSis2000CatalogMonedas()
      .then((rows) => {
        const vistas = new Set<string>();
        const out: Array<{ codigo: string; nombre: string }> = [];
        for (const m of rows ?? []) {
          const codigo = String(m.cmoneda ?? m.codigo ?? m.cvalor ?? '').trim();
          if (!codigo || vistas.has(codigo)) continue;
          vistas.add(codigo);
          out.push({ codigo, nombre: String(m.xmoneda ?? m.xdescripcion_l ?? m.xdescripcion ?? m.descripcion ?? '').trim() });
        }
        setMonedas(out);
      })
      .catch(() => undefined);
  }, []);

  const lista = (datos?.proveedores ?? []).filter((p) => verBajas || p.vigente || p.fdesde > hoy());

  /** true si se guardó. */
  async function ejecutar(accion: () => Promise<unknown>, mensaje: string): Promise<boolean> {
    setTrabajando(true);
    setError(null);
    setOk(null);
    try {
      await accion();
      setOk(mensaje);
      setMotivo('');
      cargar();
      onCambio?.();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
      return false;
    } finally {
      setTrabajando(false);
    }
  }

  function elegir(p: ProveedorCatalogo) {
    setElegido(p);
    const claves = clavesDelProveedor(p);
    setForm((f) => ({ ...f, cci_rif: String(p.cci_rif), cclave_num: String(claves[0] ?? f.cclave_num) }));
    setQ('');
  }

  function agregar() {
    const errores = validarProveedorForm(form);
    if (errores.length) {
      setError(errores.join(' '));
      return;
    }
    if (!planId) {
      const nombre = elegido?.xcliente || form.cci_rif;
      setPendientes((l) => [...l, { form, nombre }]);
      setOk(`${nombre} se agregará al plan al crearlo.`);
      setError(null);
      setElegido(null);
      setForm(PROVEEDOR_FORM_VACIO());
      return;
    }
    void ejecutar(
      () => api.agregarSis2000PlanProveedor(planId, { ...proveedorFormToPayload(form), motivoCambio: motivo || undefined }),
      `Proveedor ${elegido?.xcliente ?? form.cci_rif} agregado al plan.`,
    ).then((guardado) => {
      if (!guardado) return;
      setElegido(null);
      setForm(PROVEEDOR_FORM_VACIO());
    });
  }

  function darDeBaja(p: ProveedorPlan) {
    if (!planId) return;
    const fecha = p.fdesde > hoy() ? p.fdesde : hoy();
    if (!window.confirm(`¿Dar de baja a ${p.xcliente ?? p.cci_rif} (clave ${p.cclave_num}) con fecha ${fecha}? La fila no se borra.`)) {
      return;
    }
    void ejecutar(
      () =>
        api.bajaSis2000PlanProveedor(planId, {
          cci_rif: p.cci_rif,
          cclave_num: p.cclave_num,
          fdesde: p.fdesde,
          fhasta_baja: fecha,
          motivoCambio: motivo || undefined,
        }),
      `Proveedor ${p.xcliente ?? p.cci_rif} dado de baja desde el ${fecha}.`,
    );
  }

  function abrirEdicion(p: ProveedorPlan) {
    setEditando(`${p.cci_rif}/${p.cclave_num}/${p.fdesde}`);
    setEdicion({
      fhasta: p.fhasta ?? '',
      itiposerv: p.itiposerv == null ? '' : String(p.itiposerv),
      mcostoext: p.mcostoext == null ? '' : String(p.mcostoext),
      mcosto: p.mcosto == null ? '' : String(p.mcosto),
      cmoneda: p.cmoneda ?? '$',
    });
  }

  function guardarEdicion(p: ProveedorPlan) {
    if (!planId) return;
    const n = (v: string) => (v.trim() === '' ? undefined : Number(v));
    if (edicion.fhasta && edicion.fhasta < p.fdesde) {
      setError('La vigencia hasta es anterior a la vigencia desde.');
      return;
    }
    void ejecutar(
      () =>
        api.editarSis2000PlanProveedor(planId, {
          cci_rif: p.cci_rif,
          cclave_num: p.cclave_num,
          fdesde: p.fdesde,
          ...(edicion.fhasta ? { fhasta: edicion.fhasta } : { sin_fin: true }),
          itiposerv: n(edicion.itiposerv),
          mcostoext: n(edicion.mcostoext),
          mcosto: n(edicion.mcosto),
          cmoneda: edicion.cmoneda.trim() || undefined,
          motivoCambio: motivo || undefined,
        }),
      `Proveedor ${p.xcliente ?? p.cci_rif} actualizado.`,
    ).then((guardado) => {
      if (guardado) setEditando(null);
    });
  }

  const campo = (k: keyof ProveedorPlanForm, label: string, extra?: InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <Label htmlFor={`prov-${k}`}>{label}</Label>
      <Input id={`prov-${k}`} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} {...extra} />
    </div>
  );

  /** Select de monedas del catálogo; si el valor actual no está en la lista, se agrega para no perderlo. */
  const selectorMoneda = (id: string | undefined, valor: string, onValor: (v: string) => void) => {
    const actual = valor.trim();
    const opciones = actual && !monedas.some((m) => m.codigo === actual) ? [{ codigo: actual, nombre: '' }, ...monedas] : monedas;
    return (
      <select
        id={id}
        aria-label="Moneda"
        className="h-10 w-full rounded-md border border-border bg-background px-2"
        value={actual}
        onChange={(e) => onValor(e.target.value)}
      >
        {opciones.map((m) => (
          <option key={m.codigo} value={m.codigo}>
            {m.nombre ? `${m.codigo} · ${m.nombre}` : m.codigo}
          </option>
        ))}
      </select>
    );
  };

  return (
    <SectionPanel
      title="Proveedores"
      description="El proveedor aplica a todo el plan; al emitir pólizas de personas se registra en cada póliza. Dar de baja cierra la vigencia, no borra."
      icon={Truck}
      className={cn('mt-6', className)}
    >
      <div className="space-y-3 text-xs">
        {error && <Alert variant="error">{error}</Alert>}
        {ok && <Alert variant="success">{ok}</Alert>}
        {datos && !datos.escritura_habilitada && (
          <Alert variant="info">
            Puedes consultar los proveedores del plan, pero agregar, editar o dar de baja está desactivado hasta confirmar la
            estructura de la tabla de proveedores en Sis2000_QA.
          </Alert>
        )}
        {datos?.columna_cobertura && (
          <Alert variant="warning">
            La tabla de proveedores tiene columna de cobertura ({datos.columna_cobertura}): hay que habilitar la elección por
            cobertura antes de poder escribir.
          </Alert>
        )}

        {!planId && (
          <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
            <p className="font-semibold">
              El plan todavía no existe: los proveedores que elijas se agregan al plan en cuanto lo crees.
            </p>
            {pendientes.length === 0 ? (
              <p className="text-muted-foreground">Ningún proveedor elegido.</p>
            ) : (
              <ul className="space-y-1">
                {pendientes.map((p, i) => (
                  <li key={`${p.form.cci_rif}/${p.form.cclave_num}/${p.form.fdesde}/${i}`} className="flex items-center justify-between gap-2">
                    <span>
                      {p.nombre} · clave {p.form.cclave_num} · desde {p.form.fdesde}
                      {p.form.fhasta ? ` hasta ${p.form.fhasta}` : ' (sin fin)'}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setPendientes((l) => l.filter((_, j) => j !== i))}
                    >
                      Quitar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {planId && !datos && !error && <div className="h-16 animate-pulse rounded-lg bg-muted/60" />}

        {datos && (
          <>
            <div className="flex items-center justify-between">
              <p className="font-semibold">
                {lista.length ? `${lista.length} proveedor(es)` : 'El plan no tiene proveedores vigentes.'}
              </p>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={verBajas} onChange={(e) => setVerBajas(e.target.checked)} />
                Mostrar también los de baja
              </label>
            </div>
            {lista.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-border/50">
                <table className="w-full">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-2">Proveedor</th>
                      <th className="p-2">Clave</th>
                      <th className="p-2">Vigencia</th>
                      <th className="p-2">Servicio</th>
                      <th className="p-2">Costo</th>
                      <th className="p-2">Estado</th>
                      {escribir && <th className="p-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((p) => {
                      const k = `${p.cci_rif}/${p.cclave_num}/${p.fdesde}`;
                      const est = estadoProveedor(p);
                      return (
                        <tr key={k} className="border-t border-border/50 align-top">
                          <td className="p-2">
                            {p.xcliente || '(sin nombre)'}
                            <div className="text-muted-foreground">{p.cid || p.cci_rif}</div>
                          </td>
                          <td className="p-2">{p.cclave_num}</td>
                          <td className="p-2">
                            {p.fdesde} – {p.fhasta ?? 'sin fin'}
                          </td>
                          <td className="p-2">{p.itiposerv ?? '—'}</td>
                          <td className="p-2">{costo(p)}</td>
                          <td className="p-2">
                            <span className={cn('rounded-full px-2 py-0.5', est.clase)}>{est.texto}</span>
                          </td>
                          {escribir && (
                            <td className="p-2">
                              {editando === k ? (
                                <div className="grid min-w-[16rem] gap-1.5">
                                  <Input
                                    type="date"
                                    aria-label="Vigencia hasta (vacío = sin fin)"
                                    value={edicion.fhasta}
                                    onChange={(e) => setEdicion({ ...edicion, fhasta: e.target.value })}
                                  />
                                  <Input
                                    aria-label="Tipo de servicio"
                                    placeholder="Tipo de servicio"
                                    value={edicion.itiposerv}
                                    onChange={(e) => setEdicion({ ...edicion, itiposerv: e.target.value })}
                                  />
                                  <Input
                                    aria-label="Costo en divisa"
                                    placeholder="Costo en divisa"
                                    value={edicion.mcostoext}
                                    onChange={(e) => setEdicion({ ...edicion, mcostoext: e.target.value })}
                                  />
                                  <Input
                                    aria-label="Costo en bolívares"
                                    placeholder="Costo en bolívares (opcional)"
                                    value={edicion.mcosto}
                                    onChange={(e) => setEdicion({ ...edicion, mcosto: e.target.value })}
                                  />
                                  {monedas.length ? (
                                    selectorMoneda(undefined, edicion.cmoneda, (v) => setEdicion({ ...edicion, cmoneda: v }))
                                  ) : (
                                    <Input
                                      aria-label="Moneda"
                                      placeholder="Moneda"
                                      value={edicion.cmoneda}
                                      onChange={(e) => setEdicion({ ...edicion, cmoneda: e.target.value })}
                                    />
                                  )}
                                  <div className="flex gap-1.5">
                                    <Button type="button" size="sm" disabled={trabajando} onClick={() => guardarEdicion(p)}>
                                      Guardar
                                    </Button>
                                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditando(null)}>
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  <Button type="button" size="sm" variant="outline" disabled={trabajando} onClick={() => abrirEdicion(p)}>
                                    Editar
                                  </Button>
                                  {(p.vigente || p.fdesde > hoy()) && (
                                    <Button type="button" size="sm" variant="ghost" disabled={trabajando} onClick={() => darDeBaja(p)}>
                                      Dar de baja
                                    </Button>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {escribir && (
          <div className="space-y-2 rounded-lg border border-border/60 p-3">
            <p className="font-semibold">Agregar proveedor al plan</p>
            {elegido ? (
              <p>
                Proveedor: <strong>{elegido.xcliente}</strong> ({elegido.cid || elegido.cci_rif}){' '}
                <button type="button" className="underline" onClick={() => setElegido(null)}>
                  cambiar
                </button>
              </p>
            ) : (
              <BuscadorConLista
                id="prov-buscar"
                placeholder="Buscar proveedor por nombre o RIF…"
                q={q}
                onQ={setQ}
                opciones={catalogo.map((p) => {
                  const claves = clavesDelProveedor(p);
                  return {
                    codigo: p.cci_rif,
                    nombre: p.xcliente,
                    detalle: `${p.cid || p.cci_rif}${claves.length ? ` · claves ${claves.join(', ')}` : ''}`,
                  };
                })}
                buscando={buscando}
                listaFallo={listaFallo}
                yaElegido={() => false}
                onElegir={(o) => {
                  const p = catalogo.find((c) => c.cci_rif === o.codigo);
                  if (p) elegir(p);
                }}
                mostrarAlEnfocar
              />
            )}
            {!elegido && listaFallo && (
              <p className="text-amber-700">No se pudo cargar la lista de proveedores; intenta de nuevo en unos segundos.</p>
            )}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {elegido && clavesDelProveedor(elegido).length === 1 ? (
                <div>
                  <Label htmlFor="prov-clave">Clave del proveedor</Label>
                  <Input id="prov-clave" value={form.cclave_num} readOnly disabled title="El proveedor tiene una sola clave" />
                </div>
              ) : elegido && clavesDelProveedor(elegido).length > 1 ? (
                <div>
                  <Label htmlFor="prov-clave">Clave del proveedor</Label>
                  <select
                    id="prov-clave"
                    className="h-10 w-full rounded-md border border-border bg-background px-2"
                    value={form.cclave_num}
                    onChange={(e) => setForm({ ...form, cclave_num: e.target.value })}
                  >
                    {clavesDelProveedor(elegido).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                campo('cclave_num', 'Clave del proveedor', { type: 'number', min: 0, step: 1 })
              )}
              {campo('fdesde', 'Vigencia desde', { type: 'date' })}
              {campo('fhasta', 'Vigencia hasta (vacío = sin fin)', { type: 'date' })}
              {campo('itiposerv', 'Tipo de servicio', { type: 'number', min: 0, step: 1 })}
              {campo('mcostoext', 'Costo en divisa', { type: 'number', min: 0, step: '0.01' })}
              {campo('mcosto', 'Costo en bolívares (opcional)', { type: 'number', min: 0, step: '0.01' })}
              {monedas.length ? (
                <div>
                  <Label htmlFor="prov-cmoneda">Moneda</Label>
                  {selectorMoneda('prov-cmoneda', form.cmoneda, (v) => setForm({ ...form, cmoneda: v }))}
                </div>
              ) : (
                campo('cmoneda', 'Moneda', { maxLength: 4 })
              )}
            </div>
            <div>
              <Label htmlFor="prov-motivo">Motivo del cambio (opcional, queda en el historial)</Label>
              <Input id="prov-motivo" value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />
            </div>
            <Button type="button" size="sm" disabled={trabajando || !elegido} onClick={agregar}>
              <Plus className="h-3.5 w-3.5" />
              Agregar proveedor
            </Button>
          </div>
        )}
      </div>
    </SectionPanel>
  );
}
