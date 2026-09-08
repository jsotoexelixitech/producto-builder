import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import {
  boolLabel,
  SIS2000_FIELD_DEFS,
  sis2000SourceLabel,
  type Sis2000Product,
} from '@/lib/sis2000-catalog';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Sis2000ProductDetailDialogProps {
  product: Sis2000Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function Sis2000ProductDetailDialog({
  product,
  open,
  onOpenChange,
}: Sis2000ProductDetailDialogProps) {
  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="sis2000-detail-desc">
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <DialogTitle>
                Producto {product.cproducto}
                <span className="ml-2 font-normal text-muted-foreground">
                  — {product.xdescripcion_l}
                </span>
              </DialogTitle>
              <DialogDescription id="sis2000-detail-desc">
                Ficha completa maproductos · 27 campos · fuente{' '}
                <Badge variant={product.ifuente === 'API' ? 'approved' : 'draft'} className="ml-1">
                  {sis2000SourceLabel(product)}
                </Badge>
              </DialogDescription>
            </div>
            <Button asChild size="sm" className="shrink-0">
              <Link to={`/sis2000/${encodeURIComponent(product.cproducto)}`}>
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </Link>
            </Button>
          </div>
        </DialogHeader>
        <DialogBody>
          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SIS2000_FIELD_DEFS.map(({ key, label }) => {
              const value = product[key];
              return (
                <div key={key} className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                  <dt className="font-mono text-[10px] uppercase text-muted-foreground">
                    {label}
                  </dt>
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
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
