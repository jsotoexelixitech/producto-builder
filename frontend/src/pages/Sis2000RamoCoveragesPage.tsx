import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, RefreshCw, Shield } from 'lucide-react';
import { api } from '@/lib/api';
import { formatNestRowValue, type Sis2000NestRow } from '@/lib/sis2000-nest-api';
import { AppShell } from '@/components/layout/AppShell';
import { TablaDatos, VacioConGuia } from '@/components/ui/tabla-datos';
import { ChipEstado } from '@/components/ui/chip-estado';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { BandaPagina } from '@/components/ayudas/BandaPagina';

export function Sis2000RamoCoveragesPage() {
  const { cramo: cramoParam } = useParams<{ cramo: string }>();
  const cramo = Number(cramoParam ?? '18');
  const [rows, setRows] = useState<Sis2000NestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const aviso = (useLocation().state as { aviso?: string } | null)?.aviso ?? null;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listSis2000CoberturasByRamo(cramo);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar coberturas');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [cramo]);


  return (
    <AppShell title="Coberturas Sis2000">
      <BandaPagina className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/sis2000"
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Catálogo productos
          </Link>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <Shield className="h-5 w-5 text-primary" />
            Coberturas ramo {cramo}
          </h1>
          <p className="text-xs text-muted-foreground">
            Coberturas que existen en este ramo de Sis2000. Cualquier plan del ramo puede usarlas, siempre que tengan una
            tarifa vigente.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Recargar
          </Button>
          <Link to={`/sis2000/ramo/${cramo}/coberturas/new`}>
            <Button type="button" size="sm">
              <Plus className="h-3.5 w-3.5" />
              Nueva cobertura
            </Button>
          </Link>
        </div>
      </BandaPagina>

      {aviso && (
        <Alert variant="success" className="mb-4">
          {aviso}
        </Alert>
      )}


      {error && <Alert variant="error">{error}</Alert>}

            {!loading && !error && (
        <TablaDatos
          filas={rows}
          claveFila={(r, i) => `${String(r.ccobertura ?? '')}-${String(r.iestado ?? '')}-${String(r.u_version ?? '')}-${i}`}
          placeholderBusqueda="Buscar cobertura…"
          contar={(n) => `${n} cobertura${n === 1 ? '' : 's'}`}
          textoBusqueda={(r) => JSON.stringify(r)}
          vacio={
            <VacioConGuia
              icono={<Shield className="h-8 w-8" />}
              titulo={`El ramo ${cramo} aún no tiene coberturas`}
              texto="Crea la primera cobertura con su tarifa (suma asegurada y tasa o prima); después cualquier plan del ramo podrá usarla."
              accion={
                <Link to={`/sis2000/ramo/${cramo}/coberturas/new`}>
                  <Button type="button" size="sm">
                    <Plus className="h-3.5 w-3.5" />
                    Nueva cobertura
                  </Button>
                </Link>
              }
            />
          }
          columnas={[
            { id: 'ccobertura', titulo: 'Código', valor: (r) => String(r.ccobertura ?? ''), celda: (r) => <span className="font-mono">{String(r.ccobertura ?? '') || '—'}</span> },
            { id: 'descripcion', titulo: 'Descripción', valor: (r) => formatNestRowValue(r.xdescripcion_l ?? r.xcobertura) },
            { id: 'iestado', titulo: 'Estado', valor: (r) => String(r.iestado ?? ''), celda: (r) => <ChipEstado valor={r.iestado} /> },
            {
              id: 'acciones',
              titulo: 'Acciones',
              alinear: 'derecha',
              celda: (r) => {
                const ccob = String(r.ccobertura ?? '');
                return ccob ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link to={`/sis2000/ramo/${cramo}/coberturas/${encodeURIComponent(ccob)}/edit`} className="text-xs font-medium text-primary underline-offset-2 hover:underline">
                      Editar
                    </Link>
                    <Link to={`/sis2000/ramo/${cramo}/coberturas/${encodeURIComponent(ccob)}/tarifas`} className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline">
                      Tarifas
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
