import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, RefreshCw, Shield } from 'lucide-react';
import { api } from '@/lib/api';
import { formatNestRowValue, type Sis2000NestRow } from '@/lib/sis2000-nest-api';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function Sis2000RamoCoveragesPage() {
  const { cramo: cramoParam } = useParams<{ cramo: string }>();
  const cramo = Number(cramoParam ?? '18');
  const [rows, setRows] = useState<Sis2000NestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listSis2000CoberturasByRamo(cramo);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar coberturas');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [cramo]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <AppShell title="Coberturas Sis2000">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/sis2000"
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Catálogo productos
          </Link>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <Shield className="h-5 w-5 text-primary" />
            Coberturas ramo {cramo}
          </h1>
          <p className="text-xs text-muted-foreground">
            nest-api GET /api/v1/coberturas/{cramo} → macoberturas
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Recargar
          </Button>
          <Link to={`/sis2000/ramo/${cramo}/coberturas/new`}>
            <Button type="button" size="sm">
              <Plus className="h-3.5 w-3.5" />
              Nueva cobertura
            </Button>
          </Link>
        </div>
      </div>

      <div className="mb-4 max-w-md">
        <Input
          placeholder="Buscar cobertura…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border/50 bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">ccobertura</th>
                <th className="px-3 py-2">Descripción</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const ccob = String(row.ccobertura ?? '');
                return (
                  <tr key={ccob || i} className="border-b border-border/30">
                    <td className="px-3 py-2 font-mono text-xs">{ccob || '—'}</td>
                    <td className="px-3 py-2 text-xs">
                      {formatNestRowValue(row.xdescripcion_l ?? row.xcobertura)}
                    </td>
                    <td className="px-3 py-2 text-xs">{formatNestRowValue(row.iestado)}</td>
                    <td className="px-3 py-2 text-right">
                      {ccob && (
                        <div className="flex flex-wrap justify-end gap-2">
                          <Link
                            to={`/sis2000/ramo/${cramo}/coberturas/${encodeURIComponent(ccob)}/edit`}
                            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                          >
                            Editar
                          </Link>
                          <Link
                            to={`/sis2000/ramo/${cramo}/coberturas/${encodeURIComponent(ccob)}/tarifas`}
                            className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
                          >
                            Tarifas
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
            {filtered.length} cobertura{filtered.length === 1 ? '' : 's'}
          </p>
        </div>
      )}
    </AppShell>
  );
}
