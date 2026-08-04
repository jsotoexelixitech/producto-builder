import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Car, RefreshCw, ScanLine } from 'lucide-react';
import { api } from '@/lib/api';
import type { Product, ProductBranch } from '@/types/product';
import { EmissionShell } from '@/components/emission/EmissionShell';
import { Alert } from '@/components/ui/alert';
import { BRANCH_META, BRANCH_OPTIONS } from '@/lib/constants';
import { cn } from '@/lib/utils';

const REFRESH_MS = 20_000;

export function EmissionLauncherPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState<ProductBranch | 'ALL'>('ALL');

  const load = useCallback(async () => {
    try {
      const list = await api.listProducts();
      setProducts(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar productos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  const emitibles = useMemo(() => {
    return products.filter((p) => {
      if (p.status === 'REJECTED') return false;
      if (branchFilter !== 'ALL' && p.branch !== branchFilter) return false;
      const hasCoverages = (p.coverages?.length ?? 0) > 0;
      const hasPlans = (p.productPlans?.length ?? 0) > 0;
      return hasCoverages || hasPlans;
    });
  }, [products, branchFilter]);

  const byBranch = useMemo(() => {
    const map = new Map<ProductBranch, Product[]>();
    for (const p of emitibles) {
      const arr = map.get(p.branch) ?? [];
      arr.push(p);
      map.set(p.branch, arr);
    }
    return map;
  }, [emitibles]);

  return (
    <EmissionShell
      title="Seleccionar ramo"
      subtitle="Product-builder → OCR → emisión Exélixi"
    >
      <div className="exelixi-hero mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#00aeef]">
              <ScanLine className="h-3.5 w-3.5" />
              Flujo Exélixi · aislado de La Mundial
            </p>
            <h1 className="exelixi-hero-title mt-2">
              Selecciona el <span className="exelixi-hero-accent">ramo a emitir</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--exelixi-text-muted)]">
              Los productos del catálogo aparecen aquí en tiempo real. Al elegir uno entras al
              OCR con el ramo definido, ves los planes configurados y emites simulando el pago.
            </p>
          </div>
          <button
            type="button"
            className="exelixi-btn-outline shrink-0"
            onClick={() => load()}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        <FilterChip
          active={branchFilter === 'ALL'}
          onClick={() => setBranchFilter('ALL')}
          label="Todos los ramos"
        />
        {BRANCH_OPTIONS.map(({ value, label }) => (
          <FilterChip
            key={value}
            active={branchFilter === value}
            onClick={() => setBranchFilter(value)}
            label={label}
          />
        ))}
      </div>

      {loading && !products.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-white/60" />
          ))}
        </div>
      ) : emitibles.length === 0 ? (
        <div className="exelixi-panel py-12 text-center">
          <Car className="mx-auto h-10 w-10 text-[var(--exelixi-text-muted)]" />
          <p className="mt-4 font-bold text-[var(--exelixi-navy)]">No hay productos listos</p>
          <p className="mt-1 text-sm text-[var(--exelixi-text-muted)]">
            Crea un producto con coberturas y planes en el catálogo.
          </p>
          <Link to="/products/new" className="exelixi-btn-primary mt-6 inline-flex">
            Crear producto
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {[...byBranch.entries()].map(([branch, items]) => {
            const meta = BRANCH_META[branch];
            const Icon = meta.icon;
            return (
              <section key={branch}>
                <div className="mb-4 flex items-center gap-2">
                  <span
                    className="inline-flex rounded-lg p-2"
                    style={{ background: 'rgba(0, 174, 239, 0.12)', color: '#0284c7' }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <h2 className="text-lg font-bold text-[var(--exelixi-navy)]">{meta.label}</h2>
                  <span className="exelixi-badge-ready">{items.length}</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((product) => (
                    <ProductEmitCard key={product.id} product={product} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </EmissionShell>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('exelixi-chip', active && 'exelixi-chip-active')}
    >
      {label}
    </button>
  );
}

function ProductEmitCard({ product }: { product: Product }) {
  const meta = BRANCH_META[product.branch];
  const planCount = product.productPlans?.length ?? 0;
  const coverageCount = product.coverages?.length ?? 0;
  const ready = planCount > 0 && coverageCount > 0;

  return (
    <Link
      to={`/emitir/${product.id}`}
      className="exelixi-card group flex flex-col p-5 hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--exelixi-text-muted)]">
            {meta.short}
          </p>
          <h3 className="mt-1 font-bold leading-snug text-[var(--exelixi-navy)] group-hover:text-[var(--exelixi-orange)]">
            {product.commercialName}
          </h3>
          <p className="text-xs text-[var(--exelixi-text-muted)]">{product.internalCode}</p>
        </div>
        <span className={ready ? 'exelixi-badge-ready' : 'exelixi-badge-draft'}>
          {ready ? 'Listo' : 'Incompleto'}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-[var(--exelixi-text-muted)]">Planes</dt>
          <dd className="font-bold text-[var(--exelixi-navy)]">{planCount}</dd>
        </div>
        <div>
          <dt className="text-[var(--exelixi-text-muted)]">Coberturas</dt>
          <dd className="font-bold text-[var(--exelixi-navy)]">{coverageCount}</dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center gap-1 text-sm font-bold text-[var(--exelixi-orange)]">
        Emitir con OCR
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
