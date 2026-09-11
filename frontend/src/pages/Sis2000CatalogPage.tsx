import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Database, Eye, EyeOff, Pencil, Plus, RefreshCw, Search } from 'lucide-react';
import { api } from '@/lib/api';
import type { Sis2000Product } from '@/lib/sis2000-catalog';
import {
  boolLabel,
  formatSis2000Value,
  sis2000SourceLabel,
} from '@/lib/sis2000-catalog';
import { Sis2000ProductDetailPanel } from '@/components/sis2000/Sis2000ProductDetailPanel';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const TABLE_COLS = 12;

export function Sis2000CatalogPage() {
  const [products, setProducts] = useState<Sis2000Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const detailRowRef = useRef<HTMLTableRowElement>(null);

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

  useEffect(() => {
    if (!expandedCode) return;
    const timer = window.setTimeout(() => {
      detailRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [expandedCode]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      JSON.stringify(p).toLowerCase().includes(q),
    );
  }, [products, search]);

  function toggleDetail(cproducto: string) {
    setExpandedCode((prev) => (prev === cproducto ? null : cproducto));
  }

  return (
    <AppShell
      title="Catálogo Sis2000 (QA)"
      subtitle="Campos completos de GET /partner/products/list"
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
                Pulsa <strong>Ver detalle</strong> y la ficha se despliega{' '}
                <strong>debajo de esa fila</strong> (27 campos + planes y coberturas del
                producto). Vuelve a pulsar para cerrarla o usa <strong>Editar</strong>.
              </p>
              <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                Solo consulta y mantenimiento de catálogo Sis2000 (productos, planes,
                coberturas, tarifas). <strong>No emite pólizas</strong> ni usa
                patrimonial/emit.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Link
                  to="/sis2000/ramo/18/coberturas"
                  className="rounded-md border border-primary/30 bg-background px-2 py-1 font-medium text-primary hover:bg-primary/5"
                >
                  Coberturas ramo 18
                </Link>
                <Link
                  to="/sis2000/plans"
                  className="rounded-md border border-primary/30 bg-background px-2 py-1 font-medium text-primary hover:bg-primary/5"
                >
                  Planes maestro
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar en cualquier campo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {filtered.length} de {products.length} productos
            {expandedCode ? ` · detalle abierto: ${expandedCode}` : ''}
          </p>
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        {loading && <div className="h-48 animate-pulse rounded-2xl bg-muted/60" />}

        {!loading && !error && filtered.length === 0 && (
          <div className="empty-state">
            <Database className="mb-3 h-8 w-8 text-primary" />
            <p className="text-base font-semibold">Sin productos en el catálogo</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 font-semibold">Código</th>
                    <th className="px-3 py-3 font-semibold">Nombre</th>
                    <th className="px-3 py-3 font-semibold">Abrev.</th>
                    <th className="px-3 py-3 font-semibold">Form</th>
                    <th className="px-3 py-3 font-semibold">Ramo</th>
                    <th className="px-3 py-3 font-semibold">Tipo</th>
                    <th className="px-3 py-3 font-semibold">Corredor</th>
                    <th className="px-3 py-3 font-semibold">Canal</th>
                    <th className="px-3 py-3 font-semibold">Fuente</th>
                    <th className="px-3 py-3 font-semibold">Prima</th>
                    <th className="px-3 py-3 font-semibold">Orden</th>
                    <th className="px-3 py-3 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const isExpanded = expandedCode === p.cproducto;
                    return (
                      <Fragment key={p.cproducto}>
                        <tr
                          className={cn(
                            'border-b border-border/40 transition-colors',
                            isExpanded
                              ? 'border-l-4 border-l-primary bg-primary/5'
                              : 'border-l-4 border-l-transparent',
                          )}
                        >
                          <td className="px-3 py-3 font-mono text-xs font-semibold">
                            {p.cproducto}
                          </td>
                          <td className="px-3 py-3 max-w-[200px] truncate">{p.xdescripcion_l}</td>
                          <td className="px-3 py-3 font-mono text-xs">{p.xabreviatura}</td>
                          <td className="px-3 py-3 text-xs">{p.xform}</td>
                          <td className="px-3 py-3 text-xs">{formatSis2000Value(p.cramo)}</td>
                          <td className="px-3 py-3 text-xs">{formatSis2000Value(p.ctiporamo)}</td>
                          <td className="px-3 py-3 text-xs">{boolLabel(p.iproductor)}</td>
                          <td className="px-3 py-3 text-xs">{boolLabel(p.icanal)}</td>
                          <td className="px-3 py-3">
                            <Badge variant={p.ifuente === 'API' ? 'approved' : 'draft'}>
                              {sis2000SourceLabel(p)}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-xs">
                            {formatSis2000Value(p.mmonto_inicial)}
                          </td>
                          <td className="px-3 py-3 text-xs">{formatSis2000Value(p.norden)}</td>
                          <td className="px-3 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant={isExpanded ? 'default' : 'outline'}
                                size="sm"
                                className={cn(!isExpanded && 'border-primary/30 text-primary')}
                                onClick={() => toggleDetail(p.cproducto)}
                              >
                                {isExpanded ? (
                                  <EyeOff className="h-3.5 w-3.5" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5" />
                                )}
                                {isExpanded ? 'Ocultar' : 'Ver detalle'}
                                <ChevronDown
                                  className={cn(
                                    'h-3.5 w-3.5 transition-transform',
                                    isExpanded && 'rotate-180',
                                  )}
                                />
                              </Button>
                              <Button asChild variant="outline" size="sm">
                                <Link to={`/sis2000/${encodeURIComponent(p.cproducto)}`}>
                                  <Pencil className="h-3.5 w-3.5" />
                                  Editar
                                </Link>
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr ref={detailRowRef} className="border-b border-border/40 bg-muted/10">
                            <td colSpan={TABLE_COLS} className="px-4 py-4">
                              <Sis2000ProductDetailPanel
                                product={p}
                                onClose={() => setExpandedCode(null)}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
