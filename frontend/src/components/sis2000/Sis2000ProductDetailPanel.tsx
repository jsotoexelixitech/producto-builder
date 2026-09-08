import { Link } from 'react-router-dom';
import { Pencil, X } from 'lucide-react';
import {
  boolLabel,
  SIS2000_FIELD_DEFS,
  sis2000SourceLabel,
  type Sis2000Product,
} from '@/lib/sis2000-catalog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sis2000ProductPlansPanel } from '@/components/sis2000/Sis2000ProductPlansPanel';

interface Sis2000ProductDetailPanelProps {
  product: Sis2000Product;
  onClose: () => void;
}

export function Sis2000ProductDetailPanel({
  product,
  onClose,
}: Sis2000ProductDetailPanelProps) {
  return (
    <div className="rounded-xl border-2 border-primary/25 bg-primary/[0.03] p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-primary/15 pb-3">
        <div>
          <h3 className="text-base font-bold text-foreground">
            Producto {product.cproducto}
            <span className="ml-2 font-normal text-muted-foreground">
              — {product.xdescripcion_l}
            </span>
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Ficha maproductos · 27 campos · fuente{' '}
            <Badge variant={product.ifuente === 'API' ? 'approved' : 'draft'} className="ml-1">
              {sis2000SourceLabel(product)}
            </Badge>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild size="sm">
            <Link to={`/sis2000/${encodeURIComponent(product.cproducto)}`}>
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            Cerrar
          </Button>
        </div>
      </div>
      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {SIS2000_FIELD_DEFS.map(({ key, label }) => {
          const value = product[key];
          return (
            <div key={key} className="rounded-lg border border-border/50 bg-card px-3 py-2">
              <dt className="font-mono text-[10px] uppercase text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-all text-sm">
                {value == null || value === ''
                  ? '—'
                  : typeof value === 'boolean'
                    ? boolLabel(value)
                    : String(value)}
              </dd>
            </div>
          );
        })}
      </dl>
      <Sis2000ProductPlansPanel cproducto={product.cproducto} />
    </div>
  );
}
