import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, X } from 'lucide-react';
import {
  boolLabel,
  SIS2000_FIELD_DEFS,
  shouldShowSis2000ProductField,
  sis2000SourceLabel,
  type Sis2000Product,
} from '@/lib/sis2000-catalog';
import {
  sis2000ProductIconFileName,
  sis2000ProductIconUrl,
} from '@/lib/sis2000-product-icon';
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
            Ficha maproductos · fuente{' '}
            <Badge variant={product.ifuente === 'API' ? 'approved' : 'draft'} className="ml-1">
              {sis2000SourceLabel(product)}
            </Badge>
            · campos vacíos opcionales ocultos
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
        {SIS2000_FIELD_DEFS.filter(({ key }) =>
          shouldShowSis2000ProductField(key, product[key]),
        ).map(({ key, label }) => {
          const value = product[key];
          return (
            <ProductFieldDisplay
              key={key}
              fieldKey={key}
              label={label}
              value={value}
            />
          );
        })}
      </dl>
      <Sis2000ProductPlansPanel cproducto={product.cproducto} cramo={product.cramo} />
    </div>
  );
}

function ProductFieldDisplay({
  fieldKey,
  label,
  value,
}: {
  fieldKey: keyof Sis2000Product;
  label: string;
  value: Sis2000Product[keyof Sis2000Product];
}) {
  const [iconFailed, setIconFailed] = useState(false);
  const iconUrl =
    fieldKey === 'xdescripcion_c' ? sis2000ProductIconUrl(String(value ?? '')) : null;
  const iconName =
    fieldKey === 'xdescripcion_c' ? sis2000ProductIconFileName(String(value ?? '')) : null;

  return (
    <div className="rounded-lg border border-border/50 bg-card px-3 py-2">
      <dt className="font-mono text-[10px] uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-all text-sm">
        {value == null || value === ''
          ? '—'
          : typeof value === 'boolean'
            ? boolLabel(value)
            : String(value)}
      </dd>
      {iconName && iconUrl && !iconFailed && (
        <img
          src={iconUrl}
          alt=""
          className="mt-2 h-14 w-14 rounded-md border border-border/50 bg-muted/30 object-contain p-1"
          onError={() => setIconFailed(true)}
        />
      )}
      {iconName && iconFailed && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Icono Sis2000 ({iconName}): copia el archivo en{' '}
          <span className="font-mono">frontend/public/sis2000-icons/</span> y vuelve a cargar.
        </p>
      )}
    </div>
  );
}
