import { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import type { CoreProductSummary } from '@/lib/core-catalog';
import type { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { SectionPanel } from '@/components/ui/section-panel';
import { Alert } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CoreIntegrationPanelProps {
  product: Product | null;
  productId?: string;
  onProductUpdated?: (product: Product) => void;
  onImported?: (product: Product) => void;
}

export function CoreIntegrationPanel({
  product,
  productId,
  onProductUpdated,
  onImported,
}: CoreIntegrationPanelProps) {
  const [busy, setBusy] = useState<'sync' | 'import' | 'list' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [coreProducts, setCoreProducts] = useState<CoreProductSummary[]>([]);
  const [importCode, setImportCode] = useState('');

  async function loadCoreProducts() {
    setBusy('list');
    setError(null);
    try {
      const rows = await api.listCoreProducts(product?.branch);
      setCoreProducts(rows);
      if (rows.length && !importCode) setImportCode(rows[0].coreCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo consultar productos CORE');
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    loadCoreProducts();
  }, [product?.branch]);

  async function handleSync() {
    if (!productId) return;
    setBusy('sync');
    setError(null);
    setSuccess(null);
    try {
      const res = await api.syncProductToCore(productId);
      if (res.partner) {
        setSuccess(
          res.partnerAction === 'updated'
            ? `Producto actualizado en Sis2000 (${res.coreCode}).`
            : `Producto publicado en Sis2000 (${res.coreCode}).`,
        );
      } else if (res.remote) {
        setSuccess(`Producto sincronizado en CORE (${res.coreCode}).`);
      } else {
        setSuccess(
          `Producto registrado en catálogo local (${res.coreCode}). Configure NEST_API_KEY (partner:products) o CORE_API_URL.`,
        );
      }
      onProductUpdated?.(res.product);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar en CORE');
    } finally {
      setBusy(null);
    }
  }

  async function handleImport() {
    if (!importCode) return;
    setBusy('import');
    setError(null);
    setSuccess(null);
    try {
      const res = await api.importCoreProduct(importCode);
      if (res.imported) {
        setSuccess(`Producto importado desde CORE (${res.coreCode}).`);
        onImported?.(res.product);
      } else {
        setSuccess(`El producto CORE ${res.coreCode} ya está vinculado.`);
        onImported?.(res.product);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al importar desde CORE');
    } finally {
      setBusy(null);
    }
  }

  return (
    <SectionPanel
      title="Integración CORE / Sis2000"
      description="Publicar en catálogo Sis2000 (nest-api partner), consultar productos existentes o importar configuración."
    >
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        {product && (
          <div className="rounded-xl border border-border/60 bg-muted/15 p-4 text-sm">
            <p>
              <span className="text-muted-foreground">Estado CORE: </span>
              <strong>{product.coreSyncStatus ?? 'Sin sincronizar'}</strong>
            </p>
            {product.coreProductCode && (
              <p className="mt-1 font-mono text-xs">{product.coreProductCode}</p>
            )}
            {product.coreSyncedAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                Última sync: {new Date(product.coreSyncedAt).toLocaleString('es-VE')}
              </p>
            )}
          </div>
        )}

        {productId && (
          <Button
            type="button"
            onClick={handleSync}
            disabled={busy === 'sync'}
          >
            <RefreshCw className="h-4 w-4" />
            {busy === 'sync' ? 'Publicando…' : 'Publicar en Sis2000 / CORE'}
          </Button>
        )}

        <div className="rounded-xl border border-dashed border-border/70 p-4">
          <p className="text-sm font-semibold">Consultar e importar desde CORE</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Trae un producto ya configurado en el núcleo para editarlo en el wizard.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1">
              <Select value={importCode} onValueChange={setImportCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Producto CORE" />
                </SelectTrigger>
                <SelectContent>
                  {coreProducts.map((row) => (
                    <SelectItem key={row.coreCode} value={row.coreCode}>
                      {row.coreCode} — {row.commercialName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={busy === 'import' || !importCode}
              onClick={handleImport}
            >
              <Download className="h-4 w-4" />
              Importar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy === 'list'}
              onClick={loadCoreProducts}
            >
              Actualizar lista
            </Button>
          </div>
        </div>
      </div>
    </SectionPanel>
  );
}
