import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Layers, Plus, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { formatNestRowValue, formatTarifaDescripcion, type Sis2000NestRow } from '@/lib/sis2000-nest-api';
import { AppShell } from '@/components/layout/AppShell';
import { TablaDatos, VacioConGuia } from '@/components/ui/tabla-datos';
import { ChipEstado } from '@/components/ui/chip-estado';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { BandaPagina } from '@/components/ayudas/BandaPagina';

export function Sis2000TarifasPage() {
  const { cramo: cramoParam, ccobertura = '' } = useParams<{
    cramo: string;
    ccobertura: string;
  }>();
  const cramo = Number(cramoParam ?? '18');
  const [tarifas, setTarifas] = useState<Sis2000NestRow[]>([]);
  const [maestro, setMaestro] = useState<Sis2000NestRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const basePath = `/sis2000/ramo/${cramo}/coberturas/${encodeURIComponent(ccobertura)}`;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [cov, tar] = await Promise.all([
        api.getSis2000Cobertura(cramo, ccobertura),
        api.listSis2000Tarifas(cramo, ccobertura),
      ]);
      setMaestro(cov);
      setTarifas(tar);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar tarifas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [cramo, ccobertura]);

  return (
    <AppShell title="Tarifas Sis2000">
      <Link
        to={`/sis2000/ramo/${cramo}/coberturas`}
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Coberturas ramo {cramo}
      </Link>

      <BandaPagina className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">Tarifas · {ccobertura}</h1>
          {maestro && (
            <p className="text-xs text-muted-foreground">
              {formatNestRowValue(maestro.xdescripcion_l ?? maestro.xcobertura)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Recargar
          </Button>
          <Link to={`${basePath}/tarifas/new`}>
            <Button type="button" size="sm">
              <Plus className="h-3.5 w-3.5" />
              Nueva tarifa
            </Button>
          </Link>
        </div>
      </BandaPagina>

      {error && <Alert variant="error">{error}</Alert>}

            {!loading && !error && (
        <TablaDatos
          filas={tarifas}
          claveFila={(t, i) => String(t.ctarifa ?? '') || String(i)}
          placeholderBusqueda="Buscar tarifa…"
          contar={(n) => `${n} tarifa${n === 1 ? '' : 's'}`}
          textoBusqueda={(t) => JSON.stringify(t)}
          vacio={
            <VacioConGuia
              icono={<Layers className="h-8 w-8" />}
              titulo="Esta cobertura aún no tiene tarifas"
              texto="Sin una tarifa vigente la cobertura no se puede usar en un plan. Crea la primera con su suma asegurada y su tasa o prima."
              accion={
                <Link to={`${basePath}/tarifas/new`}>
                  <Button type="button" size="sm">
                    <Plus className="h-3.5 w-3.5" />
                    Nueva tarifa
                  </Button>
                </Link>
              }
            />
          }
          columnas={[
            { id: 'ctarifa', titulo: 'Código', valor: (t) => String(t.ctarifa ?? ''), celda: (t) => <span className="font-mono">{formatNestRowValue(t.ctarifa)}</span> },
            { id: 'xtarifam', titulo: 'Nombre', valor: (t) => formatTarifaDescripcion(t) },
            { id: 'cmoneda', titulo: 'Moneda', valor: (t) => String(t.cmoneda ?? ''), celda: (t) => formatNestRowValue(t.cmoneda) },
            { id: 'iestado', titulo: 'Estado', valor: (t) => String(t.iestado ?? ''), celda: (t) => <ChipEstado valor={t.iestado} /> },
            {
              id: 'acciones',
              titulo: 'Acciones',
              alinear: 'derecha',
              celda: (t) => {
                const ct = String(t.ctarifa ?? '');
                return ct ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link to={`${basePath}/tarifas/${encodeURIComponent(ct)}/edit`} className="text-xs font-medium text-primary underline-offset-2 hover:underline">
                      Editar
                    </Link>
                    <Link to={`${basePath}/tarifas/${encodeURIComponent(ct)}/detalles`} className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline">
                      Detalles
                    </Link>
                  </div>
                ) : null;
              },
            },
          ]}
        />
      )}
    </AppShell>
  );
}
