import { useCallback, useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { api } from '@/lib/api';
import {
  advertenciasPorConfirmar,
  cuerpoTasas,
  normalizarTasa,
  tramosVigentes,
  validarTramos,
  type CoberturaDelPlan,
  type OpcionesTramos,
  type TasaAntiguedad,
  type TramoEditable,
} from '@/lib/configurador';
import { entenderError, type ErrorEntendible } from '@/lib/errores';
import { Alert } from '@/components/ui/alert';
import { AlertaError } from '@/components/ui/errores';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionPanel } from '@/components/ui/section-panel';
import { ConfirmarDialog } from '@/components/sis2000/AsistentePasos';
import { TramosEditor } from './TramosEditor';

/**
 * Reglas del contrato §5 ajustadas a los datos reales de Sis2000_QA (18/RIES1: -1..2, 3..6, 7..11): el primer tramo
 * empieza en -1 (vehículo del año siguiente) o en 0, sin huecos ni solapes y tasa mayor que 0. Si el último tramo no
 * llega a 20 años es solo un aviso. nest-api vuelve a validar.
 */
const OPCIONES: OpcionesTramos = {
  inicio: 0,
  inicios: [-1, 0],
  minimo: -1,
  unidad: 'años',
  nombreValor: 'la tasa',
  valorPositivo: true,
  avisoSiTerminaAntesDe: 20,
  textoAviso: 'El último tramo llega hasta {hasta} años: los vehículos con más de {hasta} años no podrán cotizar este plan (Sis2000 lo rechaza al cotizar).',
};

/**
 * Tasa de casco por antigüedad del vehículo (auto), por cobertura y tarifa del plan. Tiene prioridad sobre la tasa del
 * plan al emitir. Guardar reemplaza todos los tramos vigentes de esa cobertura y tarifa.
 */
export function TasasAntiguedadPanel({
  planId,
  coberturas,
  onCambio,
}: {
  /** "cramo-cplan". */
  planId: string;
  coberturas: CoberturaDelPlan[];
  onCambio?: () => void;
}) {
  const [filas, setFilas] = useState<TasaAntiguedad[] | null>(null);
  const [error, setError] = useState<ErrorEntendible | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [elegida, setElegida] = useState('');
  const [tramos, setTramos] = useState<TramoEditable[]>([]);
  const [intento, setIntento] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [motivo, setMotivo] = useState('');
  /** Advertencias de nest-api que piden confirmar (p. ej. la cobertura no es de casco) y qué se iba a guardar. */
  const [porConfirmar, setPorConfirmar] = useState<{ avisos: string[]; quitar: boolean } | null>(null);

  const clave = (c: CoberturaDelPlan) => `${c.ccobertura}|${c.ctarifa}`;
  const cobertura = coberturas.find((c) => clave(c) === elegida);

  const cargar = useCallback(() => {
    setError(null);
    api
      .listarSis2000TasasAntiguedad(planId)
      .then((r) => setFilas(r.map(normalizarTasa)))
      .catch((e) => {
        setFilas([]);
        setError(entenderError(e, { titulo: 'No se pudieron leer las tasas por antigüedad' }));
      });
  }, [planId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Al cambiar de cobertura (o al recargar) se muestran sus tramos vigentes.
  useEffect(() => {
    if (!cobertura || !filas) return;
    setTramos(tramosVigentes(filas, cobertura.ccobertura, cobertura.ctarifa));
    setIntento(false);
  }, [elegida, filas]); // eslint-disable-line react-hooks/exhaustive-deps

  const conTramos = (c: CoberturaDelPlan) => (filas ? tramosVigentes(filas, c.ccobertura, c.ctarifa).length : 0);

  /** quitar = tramos [] (inactiva todos los tramos de la cobertura y tarifa). */
  async function guardar(confirmar = false, quitar = false) {
    if (!cobertura) return;
    if (!quitar) {
      setIntento(true);
      if (validarTramos(tramos, OPCIONES).length) return;
    }
    setGuardando(true);
    setError(null);
    setOk(null);
    setAvisos([]);
    try {
      const r = await api.guardarSis2000TasasAntiguedad(planId, cobertura.ccobertura, cobertura.ctarifa, {
        ...cuerpoTasas(quitar ? [] : tramos),
        ...(confirmar ? { confirmar: true } : {}),
        motivoCambio: motivo || undefined,
      });
      const pendientes = advertenciasPorConfirmar(r, confirmar);
      if (pendientes.length) {
        setPorConfirmar({ avisos: pendientes, quitar });
        return;
      }
      setPorConfirmar(null);
      setAvisos(Array.isArray(r?.advertencias) ? r.advertencias : []);
      setOk(quitar ? `Se quitaron los tramos de ${cobertura.nombre}: al emitir se usa la tasa del plan.` : `Tramos de ${cobertura.nombre} guardados (${tramos.length}).`);
      setMotivo('');
      cargar();
      onCambio?.();
    } catch (e) {
      setError(entenderError(e, { titulo: 'No se pudieron guardar los tramos', etiquetas: { pprima: 'Tasa' } }));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <SectionPanel
      title="Tasa por antigüedad del vehículo"
      description="Tasa de casco según los años del vehículo (año actual menos año del modelo). Si el plan tiene tramos, mandan sobre la tasa del plan y la de la solicitud. Ojo: un vehículo cuya antigüedad no cae en ningún tramo no se puede cotizar."
      icon={CalendarClock}
    >
      <div className="space-y-4 text-xs">
        <AlertaError error={error} onReintentar={cargar} />
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
        {!coberturas.length && <Alert variant="info">El plan todavía no tiene coberturas.</Alert>}

        {coberturas.length > 0 && (
          <div className="max-w-md">
            <Label htmlFor="tasas-cobertura">Cobertura</Label>
            <select
              id="tasas-cobertura"
              className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
              value={elegida}
              onChange={(e) => setElegida(e.target.value)}
            >
              <option value="">Elige la cobertura de casco…</option>
              {coberturas.map((c) => (
                <option key={clave(c)} value={clave(c)}>
                  {c.ccobertura} · {c.nombre} (tarifa {c.ctarifa}){conTramos(c) ? ` · ${conTramos(c)} tramos` : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Solo las coberturas de casco (Amplia, Pérdida total y Pérdida parcial) usan esta tabla; si eliges otra, se te avisará que no tiene efecto.
            </p>
          </div>
        )}

        {cobertura && filas && (
          <div className="space-y-3">
            {tramos.length === 0 && (
              <Alert variant="info">Esta cobertura no tiene tramos por antigüedad: se usa la tasa del plan o la tasa de casco por características.</Alert>
            )}
            <TramosEditor
              idBase="tasas-ant"
              tramos={tramos}
              onChange={setTramos}
              etiquetaDesde="Desde (años)"
              etiquetaHasta="Hasta (años)"
              etiquetaValor="Tasa %"
              ayudaDesde={'Años de antigüedad desde los que aplica el tramo. -1 = vehículo del año siguiente; 0 = del año en curso. Ejemplo: tramos -1 a 2, 3 a 6 y 7 a 11, sin huecos.\nEn Sis2000: maplantar_ano.nantiguedad_desde'}
              ayudaValor={'Tasa de casco en % sobre la suma asegurada para vehículos con esa antigüedad. Ejemplo: 3 = 3 % de la suma.\nEn Sis2000: maplantar_ano.pprima'}
              mostrarErrores={intento}
              deshabilitado={guardando}
              {...OPCIONES}
            />
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-1">
                <Label htmlFor="tasas-motivo">Motivo (opcional, queda en el historial)</Label>
                <Input id="tasas-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </div>
              {tramosVigentes(filas, cobertura.ccobertura, cobertura.ctarifa).length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={guardando}
                  onClick={() => {
                    if (window.confirm(`¿Quitar todos los tramos de ${cobertura.nombre}? Al emitir se usará la tasa del plan. Lo anterior queda en el historial.`)) {
                      void guardar(false, true);
                    }
                  }}
                >
                  Quitar todos los tramos
                </Button>
              )}
              <Button type="button" size="sm" onClick={() => void guardar()} disabled={guardando || !tramos.length}>
                {guardando ? 'Guardando…' : 'Guardar tramos'}
              </Button>
            </div>
          </div>
        )}
        {porConfirmar && (
          <ConfirmarDialog
            titulo="Revisa antes de guardar"
            confirmar="Guardar de todas formas"
            cancelar="No guardar"
            ocupado={guardando}
            onConfirmar={() => void guardar(true, porConfirmar.quitar)}
            onCancelar={() => setPorConfirmar(null)}
          >
            <p>Sis2000 avisa lo siguiente:</p>
            <ul className="list-disc space-y-1 pl-5">
              {porConfirmar.avisos.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </ConfirmarDialog>
        )}
      </div>
    </SectionPanel>
  );
}
