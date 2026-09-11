import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { formatNestRowValue, type Sis2000NestRow } from '@/lib/sis2000-nest-api';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

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

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">Historial · tarifa {ctarifa}</h1>
          <p className="text-xs text-muted-foreground">
            nest-api GET /tarifas/{cramo}/{ccobertura}/{ctarifa}/detalles
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
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border/50 bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">fdesde</th>
                <th className="px-3 py-2">fhasta</th>
                <th className="px-3 py-2">mprima</th>
                <th className="px-3 py-2">pprima</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border/30">
                  <td className="px-3 py-2 text-xs">{formatNestRowValue(r.fdesde)}</td>
                  <td className="px-3 py-2 text-xs">{formatNestRowValue(r.fhasta)}</td>
                  <td className="px-3 py-2 text-xs">{formatNestRowValue(r.mprima)}</td>
                  <td className="px-3 py-2 text-xs">{formatNestRowValue(r.pprima)}</td>
                  <td className="px-3 py-2 text-xs">{formatNestRowValue(r.iestado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-xs text-muted-foreground">
            {rows.length} registro{rows.length === 1 ? '' : 's'}
          </p>
        </div>
      )}
    </AppShell>
  );
}
