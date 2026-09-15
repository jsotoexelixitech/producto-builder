import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import {
  formatNestRowValue,
  formatTarifaDescripcion,
  pickNestRowPreview,
  pickVigenteTarifaDetalle,
  type Sis2000NestRow,
} from '@/lib/sis2000-nest-api';
import { Alert } from '@/components/ui/alert';

interface Sis2000CoverageNestPanelProps {
  cramo: number;
  ccobertura: string;
}

interface TarifaRowView {
  row: Sis2000NestRow;
  pprimaMaestro: number | null;
  mprimaMaestro: number | null;
}

/** Maestro macoberturas + tarifas matarifa (nest-api catalog:sis2000). */
export function Sis2000CoverageNestPanel({
  cramo,
  ccobertura,
}: Sis2000CoverageNestPanelProps) {
  const [maestro, setMaestro] = useState<Sis2000NestRow | null>(null);
  const [tarifas, setTarifas] = useState<TarifaRowView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const [cov, tarRows] = await Promise.all([
          api.getSis2000Cobertura(cramo, ccobertura),
          api.listSis2000Tarifas(cramo, ccobertura),
        ]);
        if (cancelled) return;

        const enriched = await Promise.all(
          tarRows.map(async (row) => {
            const ct = String(row.ctarifa ?? '1').trim() || '1';
            try {
              const detalles = await api.listSis2000TarifaDetalleHistorico(
                cramo,
                ccobertura,
                ct,
              );
              const vigente = pickVigenteTarifaDetalle(detalles);
              return {
                row,
                pprimaMaestro:
                  vigente?.pprima != null ? Number(vigente.pprima) : null,
                mprimaMaestro:
                  vigente?.mprima != null ? Number(vigente.mprima) : null,
              };
            } catch {
              return { row, pprimaMaestro: null, mprimaMaestro: null };
            }
          }),
        );

        if (cancelled) return;
        setMaestro(cov);
        setTarifas(enriched);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Error al cargar maestro Sis2000');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cramo, ccobertura]);

  if (loading) {
    return (
      <p className="text-xs text-muted-foreground">
        Cargando maestro cobertura {ccobertura} / tarifas…
      </p>
    );
  }

  if (error) {
    return <Alert variant="error">{error}</Alert>;
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-dashed border-primary/30 bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-primary">
          Sis2000 maestro · ramo {cramo} · cobertura {ccobertura}
        </p>
        <Link
          to={`/sis2000/ramo/${cramo}/coberturas/${encodeURIComponent(ccobertura)}/tarifas`}
          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          Ver tarifas completas
        </Link>
      </div>

      {maestro && (
        <dl className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
          {pickNestRowPreview(maestro, 12).map(([k, v]) => (
            <div key={k} className="rounded border border-border/40 px-2 py-1">
              <dt className="font-mono text-[10px] text-muted-foreground">{k}</dt>
              <dd className="text-xs">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <div>
        <p className="mb-1 text-xs font-semibold text-muted-foreground">
          Tarifas (matarifa) · {tarifas.length}
        </p>
        {tarifas.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin tarifas para esta cobertura.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="border-b border-border/40 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1">ctarifa</th>
                  <th className="px-2 py-1">xtarifam</th>
                  <th className="px-2 py-1">% pprima</th>
                  <th className="px-2 py-1">mprima</th>
                  <th className="px-2 py-1">Estado</th>
                </tr>
              </thead>
              <tbody>
                {tarifas.map(({ row, pprimaMaestro, mprimaMaestro }, i) => (
                  <tr key={String(row.ctarifa ?? i)} className="border-b border-border/20">
                    <td className="px-2 py-1 font-mono">{formatNestRowValue(row.ctarifa)}</td>
                    <td className="px-2 py-1">{formatTarifaDescripcion(row)}</td>
                    <td className="px-2 py-1">{formatNestRowValue(pprimaMaestro)}</td>
                    <td className="px-2 py-1">{formatNestRowValue(mprimaMaestro)}</td>
                    <td className="px-2 py-1">{formatNestRowValue(row.iestado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
