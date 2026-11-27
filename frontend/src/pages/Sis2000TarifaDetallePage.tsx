import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, History, Plus, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { formatNestRowValue, type Sis2000NestRow } from '@/lib/sis2000-nest-api';
import { AppShell } from '@/components/layout/AppShell';
import { TablaDatos, VacioConGuia } from '@/components/ui/tabla-datos';
import { ChipEstado } from '@/components/ui/chip-estado';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { deducibleDeFila, textoDeducible } from '@/lib/configurador';
import { DetalleTarifaEditor } from '@/components/configurador/DetalleTarifaEditor';
import { BandaPagina } from '@/components/ayudas/BandaPagina';

export function Sis2000TarifaDetallePage() {
  const { cramo: cramoParam, ccobertura = '', ctarifa = '' } = useParams<{
    cramo: string;
    ccobertura: string;
    ctarifa: string;
  }>();
  const cramo = Number(cramoParam ?? '18');
  const [rows, setRows] = useState<Sis2000NestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listSis2000TarifaDetalleHistorico(cramo, ccobertura, ctarifa);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar detalles');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [cramo, ccobertura, ctarifa]);

  const tarifasHref = `/sis2000/ramo/${cramo}/coberturas/${encodeURIComponent(ccobertura)}/tarifas`;
  const newHref = `${tarifasHref}/${encodeURIComponent(ctarifa)}/detalles/new`;

  return (
    <AppShell title="Detalle tarifa Sis2000">
      <Link
        to={tarifasHref}
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Tarifas {ccobertura}
      </Link>

      <BandaPagina className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">Historial · tarifa {ctarifa}</h1>
          <p className="text-xs text-muted-foreground">
            Tasas y primas que ha tenido esta tarifa. Al cotizar y emitir, Sis2000 usa la fila vigente (no mira las fechas):
            debe haber una sola.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Recargar
          </Button>
          <Link to={newHref}>
            <Button type="button" size="sm">
              <Plus className="h-3.5 w-3.5" />
              Nuevo detalle
            </Button>
          </Link>
        </div>
      </BandaPagina>

      {error && <Alert variant="error">{error}</Alert>}
      {ok && (
        <Alert variant="success" className="mb-3">
          {ok}
        </Alert>
      )}

            {!loading && !error && (
        <TablaDatos
          filas={rows}
          claveFila={(_r, i) => String(i)}
          placeholderBusqueda="Buscar en el historial…"
          contar={(n) => `${n} registro${n === 1 ? '' : 's'}`}
          textoBusqueda={(r) => JSON.stringify(r)}
          minWidth={640}
          vacio={
            <VacioConGuia
              icono={<History className="h-8 w-8" />}
              titulo="Esta tarifa no tiene tasas ni primas"
              texto="Sin un detalle vigente, Sis2000 no puede cotizar ni emitir con esta tarifa. Agrega la primera tasa o prima."
              accion={
                <Link to={newHref}>
                  <Button type="button" size="sm">
                    <Plus className="h-3.5 w-3.5" />
                    Nuevo detalle
                  </Button>
                </Link>
              }
            />
          }
          filaExtra={(r, i) =>
            editando === i ? (
              <tr>
                <td colSpan={7} className="px-3 py-2">
                  <DetalleTarifaEditor
                    cramo={cramo}
                    ccober={ccobertura}
                    ctarifa={ctarifa}
                    detalle={r}
                    onCancelar={() => setEditando(null)}
                    onGuardado={() => {
                      setEditando(null);
                      setOk('Tasa guardada (lo anterior quedó en el historial de la tarifa).');
                      void load();
                    }}
                  />
                </td>
              </tr>
            ) : null
          }
          columnas={[
            { id: 'fdesde', titulo: 'Desde', valor: (r) => String(r.fdesde ?? ''), celda: (r) => formatNestRowValue(r.fdesde) },
            { id: 'fhasta', titulo: 'Hasta', valor: (r) => String(r.fhasta ?? ''), celda: (r) => formatNestRowValue(r.fhasta) },
            { id: 'mprima', titulo: 'Prima', valor: (r) => Number(r.mprima) || 0, celda: (r) => formatNestRowValue(r.mprima) },
            { id: 'pprima', titulo: 'Tasa', valor: (r) => Number(r.pprima) || 0, celda: (r) => formatNestRowValue(r.pprima) },
            { id: 'deducible', titulo: 'Deducible', valor: (r) => textoDeducible(deducibleDeFila(r)) },
            { id: 'iestado', titulo: 'Estado', valor: (r) => String(r.iestado ?? ''), celda: (r) => <ChipEstado valor={r.iestado} /> },
            {
              id: 'acciones',
              titulo: '',
              alinear: 'derecha',
              celda: (_r, i) => (
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => {
                    setOk(null);
                    setEditando(editando === i ? null : i);
                  }}
                >
                  {editando === i ? 'Cerrar' : 'Editar'}
                </button>
              ),
            },
          ]}
        />
      )}
    </AppShell>
  );
}
