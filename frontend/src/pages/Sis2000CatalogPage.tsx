import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Database, Pencil, Plus, RefreshCw, Search } from 'lucide-react';
import { api } from '@/lib/api';
import type { Sis2000Product } from '@/lib/sis2000-catalog';
import { sis2000SourceLabel } from '@/lib/sis2000-catalog';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export function Sis2000CatalogPage() {
  const [products, setProducts] = useState<Sis2000Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const rows = await api.listSis2000Products();
      setProducts(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar catálogo Sis2000');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.cproducto.toLowerCase().includes(q) ||
        p.xdescripcion_l.toLowerCase().includes(q) ||
        p.xabreviatura.toLowerCase().includes(q) ||
        p.xform.toLowerCase().includes(q),
    );
  }, [products, search]);

  return (
    <AppShell
      title="Catálogo Sis2000 (QA)"
      subtitle="Productos en nest-api partner — consulta y edición directa"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button asChild className="bg-[#0f1a5a] hover:bg-[#091133]">
            <Link to="/sis2000/new">
              <Plus className="h-4 w-4" />
              Nuevo en Sis2000
            </Link>
          </Button>
        </div>
      }
    >
      <div className="animate-slide-up space-y-6">
        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start gap-3">
            <Database className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h2 className="text-sm font-bold text-foreground">Core / Sis2000 QA</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Lista en vivo desde <code className="text-xs">GET /partner/products/list</code>.
                Editar crea o actualiza vía los endpoints partner de nest-api.
              </p>
            </div>
          </div>
        </section>

        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por código, nombre, abreviatura…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {filtered.length} de {products.length} productos
          </p>
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        {loading && (
          <div className="h-48 animate-pulse rounded-2xl bg-muted/60" />
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="empty-state">
            <Database className="mb-3 h-8 w-8 text-primary" />
            <p className="text-base font-semibold">Sin productos en el catálogo</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Verifica NEST_API_KEY en el backend o crea uno nuevo.
            </p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Código</th>
                    <th className="px-4 py-3 font-semibold">Producto</th>
                    <th className="px-4 py-3 font-semibold">Form</th>
                    <th className="px-4 py-3 font-semibold">Ramo</th>
                    <th className="px-4 py-3 font-semibold">Fuente</th>
                    <th className="px-4 py-3 font-semibold">Prima ref.</th>
                    <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.cproducto} className="border-b border-border/40 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{p.cproducto}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{p.xdescripcion_l}</p>
                        <p className="text-xs text-muted-foreground">{p.xabreviatura}</p>
                      </td>
                      <td className="px-4 py-3 text-xs">{p.xform}</td>
                      <td className="px-4 py-3 text-xs">
                        {p.cramo ?? '—'} / tipo {p.ctiporamo ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={p.ifuente === 'API' ? 'approved' : 'draft'}>
                          {sis2000SourceLabel(p)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs">{p.mmonto_inicial ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/sis2000/${encodeURIComponent(p.cproducto)}`}>
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
