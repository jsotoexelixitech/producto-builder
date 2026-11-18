import { useCallback, useEffect, useState } from 'react';
import { Package, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { advertenciasPorConfirmar } from '@/lib/configurador';
import {
  avisosProducto,
  cuerpoProducto,
  listaDe,
  PRODUCTO_VACIO,
  productoDeFila,
  validarProducto,
  type ProductoForm as ProductoFormDatos,
} from '@/lib/configurador-fase2';
import { entenderError, type ErrorEntendible } from '@/lib/errores';
import { ConfirmarDialog } from '@/components/sis2000/AsistentePasos';
import { Alert } from '@/components/ui/alert';
import { AlertaError } from '@/components/ui/errores';
import { Button } from '@/components/ui/button';
import { InfoTip } from '@/components/ui/info-tip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionPanel } from '@/components/ui/section-panel';
import { cn } from '@/lib/utils';

type Obj = Record<string, unknown>;
type CampoTexto = 'cproducto' | 'xdescripcion_l' | 'xdescripcion_c' | 'xabreviatura' | 'xform' | 'xdescripcion_prod' | 'mmonto_inicial' | 'norden' | 'xfraccionamiento' | 'xurl_presentacion';

/** Fila de maproductos de la respuesta (objeto o lista si el código se repite en varios ramos). */
function filaDelRamo(r: unknown, cramo?: number): Obj | null {
  const lista = Array.isArray(r) ? (r as Obj[]) : listaDe(r);
  if (lista.length) return lista.find((x) => Number(x.cramo) === Number(cramo)) ?? (cramo ? null : lista[0]);
  return r && typeof r === 'object' ? (r as Obj) : null;
}

/**
 * Producto de Sis2000 (maproductos), escritura propia del configurador. Editar no cambia el código ni el ramo (si el
 * código se repite en varios ramos, solo cambia la fila del ramo indicado). Crear usa sp_CrearProducto y completa
 * quién lo ve (gestor), la pantalla de emisión y el resto de campos.
 */
export function ProductoForm({
  cproducto,
  cramo,
  nuevo = false,
  soloLectura,
  onGuardado,
}: {
  cproducto?: string;
  cramo?: number;
  nuevo?: boolean;
  soloLectura?: boolean;
  onGuardado?: (r: { cproducto: string; cramo: number }) => void;
}) {
  const [form, setForm] = useState<ProductoFormDatos>(() => ({ ...PRODUCTO_VACIO, cproducto: cproducto ?? '', cramo: cramo ? String(cramo) : '' }));
  const [cargando, setCargando] = useState(!nuevo && Boolean(cproducto));
  const [error, setError] = useState<ErrorEntendible | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [intento, setIntento] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [ramos, setRamos] = useState<Array<{ cramo: number; xdescripcion: string }>>([]);
  const [porConfirmar, setPorConfirmar] = useState<string[] | null>(null);

  const cargar = useCallback(() => {
    if (nuevo || !cproducto) return;
    setCargando(true);
    setError(null);
    api
      .leerSis2000ProductoConfigurador(cproducto)
      .then((r) => {
        const fila = filaDelRamo(r, cramo);
        if (!fila) {
          setError(entenderError(new Error(`El producto ${cproducto} no existe en el ramo ${cramo ?? ''}.`), { titulo: 'No se encontró el producto' }));
          return;
        }
        setForm(productoDeFila(fila));
      })
      .catch((e) => setError(entenderError(e, { titulo: `No se pudo leer el producto ${cproducto}` })))
      .finally(() => setCargando(false));
  }, [nuevo, cproducto, cramo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!nuevo) return;
    api
      .listSis2000Ramos()
      .then((r) => setRamos(r.map((x) => ({ cramo: Number(x.cramo), xdescripcion: String(x.xdescripcion ?? (x as Obj).xdescripcion_l ?? '').trim() }))))
      .catch(() => setRamos([]));
  }, [nuevo]);

  const errores = intento ? validarProducto(form, nuevo) : {};
  const avisosForm = avisosProducto(form, nuevo);
  const bloqueado = soloLectura || cargando;

  async function guardar(confirmar: boolean) {
    setIntento(true);
    if (Object.keys(validarProducto(form, nuevo)).length) return;
    const cuerpo = { ...cuerpoProducto(form, nuevo), motivoCambio: motivo || undefined, ...(confirmar ? { confirmar: true } : {}) };
    setGuardando(true);
    setError(null);
    setOk(null);
    setAvisos([]);
    try {
      const r = nuevo ? await api.crearSis2000ProductoCompleto(cuerpo) : await api.editarSis2000Producto(form.cproducto, cuerpo);
      const adv = advertenciasPorConfirmar(r, confirmar);
      if (adv.length) {
        setPorConfirmar(adv);
        return;
      }
      setPorConfirmar(null);
      if (Array.isArray(r?.advertencias)) setAvisos(r.advertencias.map(String));
      const codigo = String((r as Obj)?.cproducto ?? form.cproducto).trim().toUpperCase();
      setOk(nuevo ? `Producto ${codigo} creado en el ramo ${form.cramo}.` : `Producto ${codigo} guardado.`);
      setMotivo('');
      setIntento(false);
      onGuardado?.({ cproducto: codigo, cramo: Number(form.cramo) });
    } catch (e) {
      const adv = advertenciasPorConfirmar(e, confirmar);
      if (adv.length) setPorConfirmar(adv);
      else setError(entenderError(e, { titulo: nuevo ? 'No se pudo crear el producto' : 'No se pudo guardar el producto', que: 'un producto' }));
    } finally {
      setGuardando(false);
    }
  }

  const campo = (k: CampoTexto, etiqueta: string, ayuda: string, extra: { placeholder?: string; inputMode?: 'decimal' | 'numeric'; maxLength?: number; deshabilitado?: boolean } = {}) => (
    <div>
      <Label htmlFor={`prod-${k}`} className="inline-flex items-center gap-1">
        {etiqueta}
        <InfoTip text={ayuda} />
      </Label>
      <Input
        id={`prod-${k}`}
        value={form[k]}
        disabled={bloqueado || extra.deshabilitado}
        placeholder={extra.placeholder}
        inputMode={extra.inputMode}
        maxLength={extra.maxLength}
        aria-invalid={Boolean(errores[k])}
        className={cn(errores[k] && 'border-red-300')}
        onChange={(e) => setForm({ ...form, [k]: e.target.value })}
      />
      {errores[k] && <p className="mt-0.5 text-[11px] text-red-700">{errores[k]}</p>}
    </div>
  );

  const casilla = (k: 'iproductor' | 'icanal' | 'igestor', etiqueta: string) => (
    <label className="inline-flex items-center gap-2 text-slate-700">
      <input type="checkbox" disabled={bloqueado} checked={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} />
      {etiqueta}
    </label>
  );

  return (
    <SectionPanel
      title={nuevo ? 'Nuevo producto' : `Producto ${form.cproducto || cproducto || ''}`}
      description={
        nuevo
          ? 'Crea el producto en un ramo de Sis2000. Los planes se asocian después a este producto.'
          : 'Datos del producto. No se cambian el código ni el ramo.'
      }
      icon={Package}
    >
      <div className="space-y-4 text-xs">
        <AlertaError error={error} onReintentar={nuevo ? undefined : cargar} />
        {ok && <Alert variant="success">{ok}</Alert>}
        {avisos.length > 0 && (
          <Alert variant="warning">
            <ul className="list-disc space-y-0.5 pl-4">
              {avisos.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </Alert>
        )}
        {cargando && <p className="text-slate-500">Leyendo el producto…</p>}

        <div className="grid gap-3 sm:grid-cols-3">
          {campo('cproducto', 'Código', 'Código del producto (cproducto). Para usarlo en planes debe tener 6 caracteres o menos.', {
            deshabilitado: !nuevo,
            maxLength: 20,
          })}
          <div>
            <Label htmlFor="prod-cramo" className="inline-flex items-center gap-1">
              Ramo
              <InfoTip text="Ramo de Sis2000 (cramo). No se puede cambiar después de crear el producto." />
            </Label>
            {nuevo ? (
              <select
                id="prod-cramo"
                disabled={bloqueado}
                className={cn('h-10 w-full rounded-md border border-border bg-background px-2 text-sm', errores.cramo && 'border-red-300')}
                value={form.cramo}
                onChange={(e) => setForm({ ...form, cramo: e.target.value })}
              >
                <option value="">Elegir…</option>
                {ramos.map((r) => (
                  <option key={r.cramo} value={String(r.cramo)}>
                    {r.cramo} · {r.xdescripcion}
                  </option>
                ))}
              </select>
            ) : (
              <Input id="prod-cramo" value={form.cramo} disabled />
            )}
            {errores.cramo && <p className="mt-0.5 text-[11px] text-red-700">{errores.cramo}</p>}
          </div>
          {campo('xabreviatura', 'Abreviatura', 'Abreviatura del producto (xabreviatura).', { maxLength: 20 })}
          <div className="sm:col-span-2">{campo('xdescripcion_l', 'Nombre', 'Nombre largo del producto (xdescripcion_l).', { maxLength: 60 })}</div>
          {campo('xdescripcion_c', 'Nombre corto', 'Nombre corto del producto (xdescripcion_c).', { maxLength: 30 })}
        </div>

        <div className="space-y-1 rounded-xl border border-slate-200 p-3">
          <p className="flex items-center gap-1 font-semibold text-slate-800">
            Quién lo ve
            <InfoTip text="Qué tipo de intermediario puede ver el producto (iproductor, icanal, igestor)." />
          </p>
          <div className="flex flex-wrap gap-4">
            {casilla('iproductor', 'Productores')}
            {casilla('icanal', 'Canales')}
            {casilla('igestor', 'Gestores')}
          </div>
          {errores.iproductor && <p className="text-[11px] text-red-700">{errores.iproductor}</p>}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {campo('xform', 'Pantalla de emisión', 'Formulario de emisión que abre el producto (xform).', { maxLength: 100 })}
          {campo('norden', 'Orden', 'Posición del producto en las listas (norden), número entero.', { inputMode: 'numeric' })}
          {campo('mmonto_inicial', 'Monto inicial', 'Monto inicial del producto (mmonto_inicial).', { inputMode: 'decimal' })}
          {campo('xfraccionamiento', 'Fraccionamiento', 'Cómo se fracciona el pago (xfraccionamiento).', { maxLength: 100 })}
          <div className="sm:col-span-2">
            {campo('xurl_presentacion', 'Presentación (URL)', 'Dirección del documento de presentación del producto (xurl_presentacion).', {
              placeholder: 'https://…',
            })}
          </div>
        </div>
        <div>
          <Label htmlFor="prod-desc" className="inline-flex items-center gap-1">
            Descripción comercial
            <InfoTip text="Texto que describe el producto al cliente (xdescripcion_prod)." />
          </Label>
          <textarea
            id="prod-desc"
            rows={3}
            disabled={bloqueado}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs disabled:bg-slate-50"
            value={form.xdescripcion_prod}
            onChange={(e) => setForm({ ...form, xdescripcion_prod: e.target.value })}
          />
        </div>

        {avisosForm.length > 0 && (
          <Alert variant="warning">
            <ul className="list-disc space-y-0.5 pl-4">
              {avisosForm.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </Alert>
        )}

        {!soloLectura && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <Label htmlFor="prod-motivo">Motivo (opcional, queda en el historial)</Label>
              <Input id="prod-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>
            <Button type="button" size="sm" onClick={() => void guardar(false)} disabled={guardando || cargando}>
              <Save className="h-3.5 w-3.5" />
              {nuevo ? 'Crear producto' : 'Guardar producto'}
            </Button>
          </div>
        )}

        {porConfirmar && (
          <ConfirmarDialog
            titulo="Revisa antes de guardar"
            confirmar="Guardar de todas formas"
            cancelar="No guardar"
            ocupado={guardando}
            onConfirmar={() => void guardar(true)}
            onCancelar={() => setPorConfirmar(null)}
          >
            <p>Sis2000 avisa lo siguiente:</p>
            <ul className="list-disc space-y-1 pl-5">
              {porConfirmar.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </ConfirmarDialog>
        )}
      </div>
    </SectionPanel>
  );
}
