import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Layers, Plus, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import {
  formatNestRowValue,
  sis2000PlanMasterId,
  type Sis2000NestRow,
} from '@/lib/sis2000-nest-api';
import { AppShell } from '@/components/layout/AppShell';
import { TablaDatos, VacioConGuia } from '@/components/ui/tabla-datos';
import { ChipEstado } from '@/components/ui/chip-estado';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { BandaPagina } from '@/components/ayudas/BandaPagina';

export function Sis2000MasterPlansPage() {
  const [plans, setPlans] = useState<Sis2000NestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda] = useSearchParams();
  const [ramoFilter, setRamoFilter] = useState(() => busqueda.get('cramo')?.trim() || '18');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listSis2000MasterPlans();
      setPlans(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar planes maestro');
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const ramo = ramoFilter.trim();
    return plans.filter((p) => {
      if (ramo && String(p.cramo ?? '') !== ramo) return false;
      return true;
    });
  }, [plans, ramoFilter]);

  return (
    <AppShell title="Planes maestro Sis2000">
      <BandaPagina className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/sis2000"
            className="mb-2 inline-block text-xs text-muted-foreground hover:text-foreground"
          >
            ← Catálogo productos
          </Link>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <Layers className="h-5 w-5 text-primary" />
            Planes de Sis2000
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Busca un plan y pulsa «Editar» para cambiar sus datos, sus montos o agregarle coberturas con el formulario
            guiado, o «Ficha» para deducibles, comisiones, quién lo vende y la revisión «¿se puede emitir?». Para crear uno
            nuevo usa «Nuevo plan». Aquí no se emiten pólizas.
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Los cambios se graban directo en Sis2000 y antes se guarda una copia de cómo estaba el plan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Recargar
          </Button>
          <Link
            to="/sis2000/plans/new"
            className="self-center text-xs text-muted-foreground underline-offset-2 hover:underline"
            title="Crear un plan escribiendo el JSON; para lo normal usa Combos de coberturas"
          >
            Nuevo plan (modo avanzado, JSON)
          </Link>
          <Link to="/sis2000/combos">
            <Button type="button" size="sm">
              <Plus className="h-3.5 w-3.5" />
              Nuevo plan
            </Button>
          </Link>
        </div>
      </BandaPagina>

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          className="max-w-[120px]"
          placeholder="Ramo"
          value={ramoFilter}
          onChange={(e) => setRamoFilter(e.target.value)}
        />
      </div>

      {error && <Alert variant="error">{error}</Alert>}

            {!loading && !error && (
        <TablaDatos
          filas={filtered}
          claveFila={(p, i) => {
            const cplan = String(p.cplan ?? '');
            const cramo = String(p.cramo ?? '');
            return cplan && cramo ? sis2000PlanMasterId(cramo, cplan) : String(i);
          }}
          placeholderBusqueda="Buscar plan…"
          contar={(n) => `${n} plan${n === 1 ? '' : 'es'}`}
          textoBusqueda={(p) => JSON.stringify(p)}
          vacio={
            <VacioConGuia
              icono={<Layers className="h-8 w-8" />}
              titulo={ramoFilter.trim() ? `No hay planes en el ramo ${ramoFilter.trim()}` : 'Aún no hay planes'}
              texto="Un plan junta coberturas, tarifas y formas de pago de un ramo. Créalo con el formulario guiado de combos de coberturas; también puedes probar otro ramo en el filtro."
              accion={
                <Link to="/sis2000/combos">
                  <Button type="button" size="sm">
                    <Plus className="h-3.5 w-3.5" />
                    Nuevo plan
                  </Button>
                </Link>
              }
            />
          }
          columnas={[
            { id: 'cplan', titulo: 'Código', valor: (p) => String(p.cplan ?? ''), celda: (p) => <span className="font-mono">{String(p.cplan ?? '') || '—'}</span> },
            { id: 'xplan', titulo: 'Nombre', valor: (p) => formatNestRowValue(p.xplan) },
            { id: 'cramo', titulo: 'Ramo', valor: (p) => Number(p.cramo) || 0, celda: (p) => String(p.cramo ?? '') || '—' },
            { id: 'iestado', titulo: 'Estado', valor: (p) => String(p.iestado ?? ''), celda: (p) => <ChipEstado valor={p.iestado} /> },
            {
              id: 'acciones',
              titulo: 'Acciones',
              alinear: 'derecha',
              celda: (p) => {
                const cplan = String(p.cplan ?? '');
                const cramo = String(p.cramo ?? '');
                if (!cplan || !cramo) return null;
                const id = sis2000PlanMasterId(cramo, cplan);
                return (
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link
                      to={`/sis2000/plans/${encodeURIComponent(id)}/configurar`}
                      className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                      title="Ficha completa del plan: coberturas, tarifas, deducibles, formas de pago, quién lo vende, comisiones y la revisión «¿se puede emitir?»"
                    >
                      Ficha
                    </Link>
                    <Link
                      to={`/sis2000/plans/${encodeURIComponent(id)}/edit`}
                      className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                      title="Cambiar nombre, montos o coberturas con el formulario guiado"
                    >
                      Editar
                    </Link>
                    <Link
                      to={`/sis2000/plans/${encodeURIComponent(id)}/json`}
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                      title="Editor en JSON, solo para casos que el formulario no cubre"
                    >
                      Modo avanzado
                    </Link>
                  </div>
                );
              },
            },
          ]}
        />
      )}
    </AppShell>
  );
}
