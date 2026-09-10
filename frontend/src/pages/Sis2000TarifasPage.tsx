import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
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
          <h1 className="text-lg font-bold">
            Tarifas · {ccobertura}
          </h1>
          {maestro && (
            <p className="text-xs text-muted-foreground">
              {formatNestRowValue(maestro.xdescripcion_l ?? maestro.xcobertura)}
            </p>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Recargar
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border/50 bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">ctarifa</th>
                <th className="px-3 py-2">Descripción</th>
                <th className="px-3 py-2">Moneda</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {tarifas.map((t, i) => (
                <tr key={String(t.ctarifa ?? i)} className="border-b border-border/30">
                  <td className="px-3 py-2 font-mono text-xs">{formatNestRowValue(t.ctarifa)}</td>
                  <td className="px-3 py-2 text-xs">
                    {formatNestRowValue(t.xdescripcion_l ?? t.xplan)}
                  </td>
                  <td className="px-3 py-2 text-xs">{formatNestRowValue(t.cmoneda)}</td>
                  <td className="px-3 py-2 text-xs">{formatNestRowValue(t.iestado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-xs text-muted-foreground">
            {tarifas.length} tarifa{tarifas.length === 1 ? '' : 's'} · nest-api GET /tarifas/{cramo}/{ccobertura}
          </p>
        </div>
      )}
    </AppShell>
  );
}
