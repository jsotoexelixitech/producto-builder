import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { formatNestRowValue, type Sis2000NestRow } from '@/lib/sis2000-nest-api';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export function Sis2000TarifasPage() {
  const { cramo: cramoParam, ccobertura = '' } = useParams<{
    cramo: string;
    ccobertura: string;
  }>();
  const cramo = Number(cramoParam ?? '18');
  const [tarifas, setTarifas] = useState<Sis2000NestRow[]>([]);
  const [maestro, setMaestro] = useState<Sis2000NestRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const basePath = `/sis2000/ramo/${cramo}/coberturas/${encodeURIComponent(ccobertura)}`;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [cov, tar] = await Promise.all([
        api.getSis2000Cobertura(cramo, ccobertura),
        api.listSis2000Tarifas(cramo, ccobertura),
      ]);
      setMaestro(cov);
      setTarifas(tar);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar tarifas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [cramo, ccobertura]);

  return (
    <AppShell title="Tarifas Sis2000">
      <Link
        to={`/sis2000/ramo/${cramo}/coberturas`}
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Coberturas ramo {cramo}
      </Link>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">Tarifas · {ccobertura}</h1>
          {maestro && (
            <p className="text-xs text-muted-foreground">
              {formatNestRowValue(maestro.xdescripcion_l ?? maestro.xcobertura)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Recargar
          </Button>
          <Link to={`${basePath}/tarifas/new`}>
            <Button type="button" size="sm">
              <Plus className="h-3.5 w-3.5" />
              Nueva tarifa
            </Button>
          </Link>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border/50 bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">ctarifa</th>
                <th className="px-3 py-2">Descripción</th>
                <th className="px-3 py-2">Moneda</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tarifas.map((t, i) => {
                const ct = String(t.ctarifa ?? '');
                return (
                  <tr key={ct || i} className="border-b border-border/30">
                    <td className="px-3 py-2 font-mono text-xs">{formatNestRowValue(t.ctarifa)}</td>
                    <td className="px-3 py-2 text-xs">
                      {formatNestRowValue(t.xdescripcion_l ?? t.xplan)}
                    </td>
                    <td className="px-3 py-2 text-xs">{formatNestRowValue(t.cmoneda)}</td>
                    <td className="px-3 py-2 text-xs">{formatNestRowValue(t.iestado)}</td>
                    <td className="px-3 py-2 text-right">
                      {ct && (
                        <div className="flex flex-wrap justify-end gap-2">
                          <Link
                            to={`${basePath}/tarifas/${encodeURIComponent(ct)}/edit`}
                            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                          >
                            Editar
                          </Link>
                          <Link
                            to={`${basePath}/tarifas/${encodeURIComponent(ct)}/detalles`}
                            className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
                          >
                            Detalles
                          </Link>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-3 py-2 text-xs text-muted-foreground">
            {tarifas.length} tarifa{tarifas.length === 1 ? '' : 's'}
          </p>
        </div>
      )}
    </AppShell>
  );
}
