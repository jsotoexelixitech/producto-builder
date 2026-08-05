import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  FileCheck2,
  Layers,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Product, ProductBranch } from '@/types/product';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Badge, statusBadgeVariant } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { BRANCH_META, DEFAULT_DOCUMENTS_BY_BRANCH, STATUS_LABELS } from '@/lib/constants';
import { FIELD_LIMITS } from '@/lib/field-limits';
import { buildFlowPreviewContext } from '@/lib/emission-flow';
import { cn } from '@/lib/utils';

type StatusFilter = 'ALL' | Product['status'];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'ACTUARIAL_REVIEW', label: 'Actuarial' },
  { value: 'SUBMITTED_TO_SUDEASEG', label: 'SUDEASEG' },
  { value: 'APPROVED_ACTIVE', label: 'Aprobados' },
];

export function DashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [branchFilter, setBranchFilter] = useState<ProductBranch | 'ALL'>('ALL');
  const [busyProductId, setBusyProductId] = useState<string | null>(null);

  async function handleDelete(p: Product) {
    const ok = window.confirm(
      `¿Eliminar "${p.commercialName}"? Se borran sus coberturas, planes y configuración. Esta acción no se puede deshacer.`,
    );
    if (!ok) return;
    setBusyProductId(p.id);
    try {
      await api.deleteProduct(p.id);
      setProducts((prev) => prev.filter((x) => x.id !== p.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error eliminando el producto');
    } finally {
      setBusyProductId(null);
    }
  }

  async function handleToggleCatalog(p: Product) {
    const currentlyVisible = p.catalogVisible !== false;
    const nextVisible = !currentlyVisible;
    const ok = window.confirm(
      nextVisible
        ? `¿Activar "${p.commercialName}"? Volverá a aparecer en el catálogo de emisión.`
        : `¿Desactivar "${p.commercialName}"? Dejará de verse en el catálogo de emisión; no se borra y podrás reactivarlo.`,
    );
    if (!ok) return;
    setBusyProductId(p.id);
    try {
      const updated = await api.setCatalogVisibility(p.id, nextVisible);
      setProducts((prev) =>
        prev.map((x) =>
          x.id === p.id
            ? { ...x, catalogVisible: updated.catalogVisible ?? nextVisible }
            : x,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cambiar la visibilidad');
    } finally {
      setBusyProductId(null);
    }
  }

  useEffect(() => {
    api
      .listProducts()
      .then(setProducts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (branchFilter !== 'ALL' && p.branch !== branchFilter) return false;
      if (!q) return true;
      return (
        p.commercialName.toLowerCase().includes(q) ||
        p.internalCode.toLowerCase().includes(q) ||
        BRANCH_META[p.branch].label.toLowerCase().includes(q)
      );
    });
  }, [products, search, statusFilter, branchFilter]);

  const stats = {
    total: products.length,
    draft: products.filter((p) => p.status === 'DRAFT').length,
    approved: products.filter((p) => p.status === 'APPROVED_ACTIVE').length,
  };

  const hasActiveFilters =
    search.trim() !== '' || statusFilter !== 'ALL' || branchFilter !== 'ALL';

  function clearFilters() {
    setSearch('');
    setStatusFilter('ALL');
    setBranchFilter('ALL');
  }

  return (
    <AppShell
      title="Constructor de productos"
      subtitle="Configura planes, coberturas, documentos y flujo de emisión"
      actions={
        <Button asChild className="bg-[#0f1a5a] hover:bg-[#091133]">
          <Link to="/products/new">
            <Plus className="h-4 w-4" />
            Nuevo producto
          </Link>
        </Button>
      }
    >
      <div className="animate-slide-up space-y-6">
        <section className="brand-hero px-6 py-7 sm:px-8 sm:py-9">
          <span className="brand-hero-orb brand-hero-orb-a" aria-hidden />
          <span className="brand-hero-orb brand-hero-orb-b" aria-hidden />
          <span className="brand-grain" aria-hidden />

          <div className="relative max-w-3xl">
            <span className="brand-kicker">La Mundial · SUDEASEG</span>
            <h1 className="mt-3 text-2xl font-bold leading-tight text-white sm:text-3xl [text-wrap:balance]">
              Diseña productos de seguros y previsualiza el{' '}
              <span className="font-wordmark text-[#FF6675]">flujo de emisión</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 [text-wrap:pretty]">
              Cada producto define sus propios datos, documentos y pasos. RCV, patrimonial,
              vida, salud o cualquier ramo.
            </p>
            <div className="brand-accent-bar mt-5" />
          </div>
        </section>

        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <h2 className="text-sm font-bold text-foreground">¿Dónde se configura cada cosa?</h2>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Paso 2 «Coberturas»:</strong> define las coberturas del producto.
            </li>
            <li>
              <strong className="text-foreground">Paso 3 «Planes»:</strong> opciones comerciales y qué coberturas incluye cada plan.
            </li>
            <li>
              <strong className="text-foreground">Pasos 4–5:</strong> actuarial y legal (documentos OCR).
            </li>
            <li>
              <strong className="text-foreground">Paso 6 «Flujo de emisión»:</strong> en cada bloque
              «Formulario del paso: …» defines los campos de ese paso (cliente, riesgo, etc.).
            </li>
            <li>
              <strong className="text-foreground">Botón «Ver flujo»:</strong> vista previa de cómo lo verá el cliente al cotizar.
            </li>
          </ol>
        </div>

        <div className="dashboard-stat-grid">
          {[
            { label: 'Productos', value: stats.total, icon: Layers },
            { label: 'En borrador', value: stats.draft, icon: FileCheck2 },
            { label: 'Aprobados', value: stats.approved, icon: ShieldCheck },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="dashboard-stat flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="tabular-nums text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold">Catálogo de productos</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {filtered.length} de {products.length}
                {hasActiveFilters ? ' · filtros activos' : ''}
              </p>
            </div>
            <div className="relative w-full lg:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                maxLength={FIELD_LIMITS.dashboard.search}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-border/40 pt-4">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  'filter-chip',
                  statusFilter === f.value ? 'filter-chip-active' : 'filter-chip-inactive',
                )}
              >
                {f.label}
              </button>
            ))}
            <span className="mx-1 hidden h-5 w-px bg-border sm:inline" />
            <button
              type="button"
              onClick={() => setBranchFilter('ALL')}
              className={cn(
                'filter-chip',
                branchFilter === 'ALL' ? 'filter-chip-active' : 'filter-chip-inactive',
              )}
            >
              Todos los ramos
            </button>
            {(Object.entries(BRANCH_META) as [ProductBranch, (typeof BRANCH_META)[ProductBranch]][]).map(
              ([branch, meta]) => (
                <button
                  key={branch}
                  type="button"
                  onClick={() => setBranchFilter(branch)}
                  className={cn(
                    'filter-chip',
                    branchFilter === branch ? 'filter-chip-active' : 'filter-chip-inactive',
                  )}
                >
                  {meta.short}
                </button>
              ),
            )}
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="filter-clear ml-auto">
                Limpiar
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-muted/60" />
            ))}
          </div>
        )}

        {error && (
          <Alert variant="error">
            {error}. Verifica que el backend esté en el puerto 3001.
          </Alert>
        )}

        {!loading && !error && products.length === 0 && (
          <div className="empty-state">
            <Sparkles className="mb-3 h-8 w-8 text-primary" />
            <p className="text-base font-semibold">Comienza tu primer producto</p>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
              Configura coberturas, documentos y el flujo guiado de emisión para cualquier ramo.
            </p>
            <Button asChild className="mt-5">
              <Link to="/products/new">
                <Plus className="h-4 w-4" />
                Crear producto
              </Link>
            </Button>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => {
              const meta = BRANCH_META[p.branch];
              const Icon = meta.icon;
              const flowSteps = buildFlowPreviewContext(p).steps.length;
              const docCount =
                p.requiredDocuments?.length ??
                Object.keys(DEFAULT_DOCUMENTS_BY_BRANCH[p.branch] ?? {}).length;

              return (
                <article key={p.id} className="product-card-v2">
                  <div className="flex items-start justify-between gap-3">
                    <div className={cn('branch-medallion', meta.color, 'ring-1', meta.ring)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {p.catalogVisible === false && (
                        <Badge variant="rejected">Desactivado</Badge>
                      )}
                      <Badge variant={statusBadgeVariant(p.status)}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                    </div>
                  </div>

                  <h3 className="mt-3 truncate font-semibold tracking-tight">{p.commercialName}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-mono">{p.internalCode}</span> · {meta.label}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span>{flowSteps} pasos de emisión</span>
                    <span>·</span>
                    <span>{docCount} documentos</span>
                    <span>·</span>
                    <span>{p.coverages?.length ?? 0} coberturas</span>
                  </div>

                  <div className="product-card-v2-actions">
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link to={`/products/${p.id}`}>
                        <Settings2 className="h-3.5 w-3.5" />
                        Configurar
                      </Link>
                    </Button>
                    <Button asChild size="sm" className="flex-1 bg-[#0f1a5a] hover:bg-[#091133]">
                      <Link to={`/products/${p.id}/preview`}>
                        <Eye className="h-3.5 w-3.5" />
                        Ver flujo
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyProductId === p.id}
                      onClick={() => handleToggleCatalog(p)}
                      title={
                        p.catalogVisible === false
                          ? 'Activar en catálogo de emisión'
                          : 'Desactivar (ocultar del catálogo de emisión)'
                      }
                      className={cn(
                        'shrink-0 px-2.5',
                        p.catalogVisible === false
                          ? 'text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                          : 'text-amber-700 border-amber-300 hover:bg-amber-50',
                      )}
                    >
                      {p.catalogVisible === false ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    {!p.isImmutable && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyProductId === p.id}
                        onClick={() => handleDelete(p)}
                        title="Eliminar producto"
                        className="shrink-0 px-2.5 text-red-600 border-red-300 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
