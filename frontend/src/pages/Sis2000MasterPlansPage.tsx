import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Plus, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import {
  formatNestRowValue,
  sis2000PlanMasterId,
  type Sis2000NestRow,
} from '@/lib/sis2000-nest-api';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function Sis2000MasterPlansPage() {
  const [plans, setPlans] = useState<Sis2000NestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ramoFilter, setRamoFilter] = useState('18');
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listSis2000MasterPlans();
      setPlans(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar planes maestro');
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const ramo = ramoFilter.trim();
    return plans.filter((p) => {
      if (ramo && String(p.cramo ?? '') !== ramo) return false;
      if (!q) return true;
      return JSON.stringify(p).toLowerCase().includes(q);
    });
  }, [plans, search, ramoFilter]);

  return (
    <AppShell title="Planes maestro Sis2000">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/sis2000"
            className="mb-2 inline-block text-xs text-muted-foreground hover:text-foreground"
          >
            ← Catálogo productos
          </Link>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <Layers className="h-5 w-5 text-primary" />
            Planes maestro (maplanes)
          </h1>
          <p className="text-xs text-muted-foreground">
            nest-api GET /api/v1/partner/starter/plan · edición vía spMantPlanes
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Recargar
          </Button>
          <Link to="/sis2000/plans/new">
            <Button type="button" size="sm">
              <Plus className="h-3.5 w-3.5" />
              Nuevo plan
            </Button>
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          className="max-w-xs"
          placeholder="Buscar plan…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Input
          className="max-w-[120px]"
          placeholder="Ramo"
          value={ramoFilter}
          onChange={(e) => setRamoFilter(e.target.value)}
        />
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border/50 bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">cplan</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Ramo</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Editar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const cplan = String(p.cplan ?? '');
                const cramo = String(p.cramo ?? '');
                const id = cplan && cramo ? sis2000PlanMasterId(cramo, cplan) : String(i);
                return (
                  <tr key={id} className="border-b border-border/30">
                    <td className="px-3 py-2 font-mono text-xs">{cplan || '—'}</td>
                    <td className="px-3 py-2 text-xs">{formatNestRowValue(p.xplan)}</td>
                    <td className="px-3 py-2 text-xs">{cramo || '—'}</td>
                    <td className="px-3 py-2 text-xs">{formatNestRowValue(p.iestado)}</td>
                    <td className="px-3 py-2 text-right">
                      {cplan && cramo && (
                        <Link
                          to={`/sis2000/plans/${encodeURIComponent(id)}/edit`}
                          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                        >
                          Editar
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-3 py-2 text-xs text-muted-foreground">
            {filtered.length} plan{filtered.length === 1 ? '' : 'es'}
          </p>
        </div>
      )}
    </AppShell>
  );
}
