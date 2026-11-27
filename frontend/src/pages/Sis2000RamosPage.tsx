import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ListChecks, Plus, RefreshCw, Shapes } from 'lucide-react';
import { api } from '@/lib/api';
import {
  avisosRamo,
  filtrarRamos,
  NOMBRE_EMISION,
  NOMBRE_FAMILIA,
  normalizarRamoCatalogo,
  ramoPermiteCrearPlan,
  type RamoCatalogo,
} from '@/lib/configurador-fase2';
import { entenderError, type ErrorEntendible } from '@/lib/errores';
import { AppShell } from '@/components/layout/AppShell';
import { ChipEstado } from '@/components/ui/chip-estado';
import type { EstadoChip } from '@/lib/estado-chip';
import { AlertaError } from '@/components/ui/errores';
import { Button } from '@/components/ui/button';
import { InfoTip } from '@/components/ui/info-tip';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { BandaPagina } from '@/components/ayudas/BandaPagina';

const FILTROS = [
  { id: 'todas', titulo: 'Todas' },
  { id: 'auto', titulo: 'Automóvil' },
  { id: 'personas', titulo: 'Personas' },
  { id: 'patrimonial', titulo: 'Patrimoniales' },
  { id: 'fianzas', titulo: 'Fianzas' },
];

const ESTADO: Record<string, { texto: string; estado: EstadoChip }> = {
  activo: { texto: 'Activo', estado: 'activo' },
  'sin-planes': { texto: 'Sin planes', estado: 'borrador' },
  inactivo: { texto: 'Inactivo', estado: 'inactivo' },
};

/**
 * Catálogo de ramos de Sis2000 (/sis2000/ramos): familia, estado, emisión Nexus y cuántos planes y productos tiene cada
 * ramo (GET ramos de nest-api). Desde aquí se ven los planes del ramo o se crea uno con el asistente.
 */
export function Sis2000RamosPage() {
  const [ramos, setRamos] = useState<RamoCatalogo[] | null>(null);
  const [error, setError] = useState<ErrorEntendible | null>(null);
  const [familia, setFamilia] = useState('todas');
  const [q, setQ] = useState('');

  const cargar = useCallback(() => {
    setError(null);
    setRamos(null);
    api
      .listSis2000Ramos()
      .then((r) => setRamos((Array.isArray(r) ? r : []).map((x) => normalizarRamoCatalogo(x as Record<string, unknown>)).sort((a, b) => a.cramo - b.cramo)))
      .catch((e) => {
        setRamos([]);
        setError(entenderError(e, { titulo: 'No se pudieron leer los ramos de Sis2000' }));
      });
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const visibles = useMemo(() => filtrarRamos(ramos ?? [], { familia, q }), [ramos, familia, q]);
  const cuenta = (f: string) => filtrarRamos(ramos ?? [], { familia: f }).length;
  const num = (n: number | null) => (n == null ? '—' : n.toLocaleString('es-VE'));

  return (
    <AppShell title="Ramos de Sis2000">
      <BandaPagina className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <Shapes className="h-5 w-5 text-primary" />
            Ramos de Sis2000
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Cada ramo pertenece a una familia (automóvil, personas, patrimoniales o fianzas). La familia decide qué se
            configura en sus planes (por ejemplo, tipo y uso del vehículo en automóvil o tablas por edad en personas) y con
            qué emisión de Nexus se venden. Elige un ramo para ver sus planes o crear uno nuevo.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={cargar} disabled={ramos === null}>
          <RefreshCw className={cn('h-3.5 w-3.5', ramos === null && 'animate-spin')} />
          Recargar
        </Button>
      </BandaPagina>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <nav aria-label="Familias" className="flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFamilia(f.id)}
              aria-current={f.id === familia ? 'page' : undefined}
              className={cn(
                'rounded-xl px-3 py-1.5 text-xs font-semibold',
                f.id === familia ? 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200' : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              {f.titulo} {ramos ? <span className="text-slate-400">({cuenta(f.id)})</span> : null}
            </button>
          ))}
        </nav>
        <Input className="max-w-xs" placeholder="Buscar por número o nombre…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <AlertaError error={error} onReintentar={cargar} className="mb-3" />

      {ramos === null ? (
        <p className="text-sm text-slate-500">Leyendo los ramos…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Ramo</th>
                <th className="px-3 py-2">Familia</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">
                  <span className="inline-flex items-center gap-1">
                    Emisión Nexus
                    <InfoTip text={'Con qué emisión de Nexus se venden los planes del ramo: automóvil, personas o patrimoniales. Si dice «Ninguna», Nexus no tiene emisión para ese ramo (por ejemplo, fianzas) y sus planes solo se consultan. Una familia nueva necesita su propio procedimiento de emisión.\nEn Sis2000: maramos.ctiporamo'} />
                  </span>
                </th>
                <th className="px-3 py-2 text-right">Planes</th>
                <th className="px-3 py-2 text-right">Productos</th>
                <th className="px-3 py-2">Avisos</th>
                <th className="px-3 py-2 text-right" />
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-slate-500">
                    No hay ramos con ese filtro.
                  </td>
                </tr>
              )}
              {visibles.map((r) => {
                const avisos = avisosRamo(r);
                const estado = ESTADO[r.estado];
                return (
                  <tr key={r.cramo} className="border-b border-slate-100 align-top last:border-0">
                    <td className="px-3 py-2">
                      <span className="font-mono font-semibold">{r.cramo}</span> · {r.nombre || '—'}
                      {r.colectivo && <span className="ml-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-800">Colectivo</span>}
                    </td>
                    <td className="px-3 py-2">{NOMBRE_FAMILIA[r.familia]}</td>
                    <td className="px-3 py-2">
                      {estado ? <ChipEstado estado={estado.estado} texto={estado.texto} /> : '—'}
                    </td>
                    <td className="px-3 py-2">{r.emisionNexus ? NOMBRE_EMISION[r.emisionNexus] ?? r.emisionNexus : <span className="text-slate-500">Ninguna</span>}</td>
                    <td className="px-3 py-2 text-right">{num(r.planes)}</td>
                    <td className="px-3 py-2 text-right">{num(r.productos)}</td>
                    <td className="px-3 py-2">
                      {avisos.length ? (
                        <ul className="space-y-0.5">
                          {avisos.map((a, i) => (
                            <li key={i} className="flex gap-1 text-amber-900">
                              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                              {a}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          to={`/sis2000/plans?cramo=${r.cramo}`}
                          className="inline-flex items-center gap-1 font-semibold text-indigo-700 underline-offset-2 hover:underline"
                        >
                          <ListChecks className="h-3.5 w-3.5" />
                          Ver planes
                        </Link>
                        {ramoPermiteCrearPlan(r) && (
                          <Link
                            to={`/sis2000/combos?cramo=${r.cramo}`}
                            className="inline-flex items-center gap-1 font-semibold text-indigo-700 underline-offset-2 hover:underline"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Crear plan
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-3 py-2 text-xs text-muted-foreground">
            {visibles.length} ramo{visibles.length === 1 ? '' : 's'}
          </p>
        </div>
      )}
    </AppShell>
  );
}
