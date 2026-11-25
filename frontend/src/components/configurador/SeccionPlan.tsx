import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { coberturasDelPlan, infoSeccion } from '@/lib/configurador';
import { Alert } from '@/components/ui/alert';
import { SectionPanel } from '@/components/ui/section-panel';
import { ComisionesPanel } from '@/components/configurador/ComisionesPanel';
import { DeduciblesPanel } from '@/components/configurador/DeduciblesPanel';
import { RevisionPlanPanel } from '@/components/configurador/RevisionPlanPanel';
import { TasasAntiguedadPanel } from '@/components/configurador/TasasAntiguedadPanel';
import { TiposUsoPanel } from '@/components/configurador/TiposUsoPanel';
import { CoberturasPlanPanel } from '@/components/configurador/CoberturasPlanPanel';
import { CondominioPanel } from '@/components/configurador/CondominioPanel';
import { DescuentosRecargosPanel } from '@/components/configurador/DescuentosRecargosPanel';
import { EdadesParentescoPanel } from '@/components/configurador/EdadesParentescoPanel';
import { FrecuenciasPanel } from '@/components/configurador/FrecuenciasPanel';
import { PlanCabeceraForm } from '@/components/configurador/PlanCabeceraForm';
import { ProductoForm } from '@/components/configurador/ProductoForm';
import { QuienVendePanel } from '@/components/configurador/QuienVendePanel';
import { TarifaDiasPanel } from '@/components/configurador/TarifaDiasPanel';
import { TasaCascoPanel } from '@/components/configurador/TasaCascoPanel';
import { ProveedoresPlanPanel } from '@/components/sis2000/ProveedoresPlanPanel';

type Fila = Record<string, unknown>;
const txt = (v: unknown) => (v == null ? '' : String(v).trim());

/**
 * Panel de una sección del plan (la misma pantalla para la ficha del plan y para el Combo de coberturas): cada
 * sección que declara GET ramos/:cramo → secciones se resuelve aquí. Los paneles guardan por sí mismos.
 */
export function SeccionPlan({
  seccion,
  id,
  cramo,
  plan,
  coberturas,
  filasPlanCob,
  moneda,
  familia,
  soloLectura,
  catalogo,
  editarPlan,
  cambios,
  onCambio,
  onIrSeccion,
}: {
  seccion: string;
  id: string;
  cramo: number;
  plan: Fila | null;
  coberturas: ReturnType<typeof coberturasDelPlan>;
  filasPlanCob: Fila[];
  moneda: string;
  familia?: string;
  soloLectura: boolean;
  catalogo: Fila[];
  editarPlan: string;
  cambios: number;
  onCambio: () => void;
  onIrSeccion: (s: string) => void;
}) {
  const cplan = txt(plan?.cplan) || id.split('-').slice(1).join('-');
  switch (seccion) {
    case 'producto':
      return txt(plan?.cproducto) ? (
        <ProductoForm key={txt(plan?.cproducto)} cproducto={txt(plan?.cproducto)} cramo={cramo} soloLectura={soloLectura} onGuardado={onCambio} />
      ) : (
        <Alert variant="info">El plan no tiene producto: elígelo en «Datos del plan».</Alert>
      );
    case 'plan':
      return <PlanCabeceraForm planId={id} plan={plan} cramo={cramo} soloLectura={soloLectura} onCambio={onCambio} />;
    case 'coberturas':
      return <CoberturasPlanPanel planId={id} cramo={cramo} familia={familia} plan={plan} catalogo={catalogo} soloLectura={soloLectura} onCambio={onCambio} />;
    case 'deducibles':
      return <DeduciblesPanel planId={id} cramo={cramo} coberturas={coberturas} filasPlan={filasPlanCob} moneda={moneda} conCopiaEnPlan={familia !== 'personas'} conDescuentoAuto={familia === 'auto'} onCambio={onCambio} />;
    case 'frecuencias':
      return <FrecuenciasPanel planId={id} soloLectura={soloLectura} onCambio={onCambio} />;
    case 'quien-vende':
    case 'canales':
      return <QuienVendePanel planId={id} soloLectura={soloLectura} onCambio={onCambio} />;
    case 'comisiones':
      return <ComisionesPanel planId={id} coberturas={coberturas} onCambio={onCambio} />;
    case 'tipos-uso':
      return <TiposUsoPanel cramo={cramo} onCambio={onCambio} />;
    case 'tasas-antiguedad':
      return <TasasAntiguedadPanel planId={id} coberturas={coberturas} onCambio={onCambio} />;
    case 'tasa-casco':
      return <TasaCascoPanel cramo={cramo} soloLectura={soloLectura} onCambio={onCambio} />;
    case 'tarifa-dias':
      return <TarifaDiasPanel planId={id} cplan={cplan} coberturas={coberturas} soloLectura={soloLectura} onCambio={onCambio} />;
    case 'edades-parentesco':
      return <EdadesParentescoPanel planId={id} plan={plan} soloLectura={soloLectura} onCambio={onCambio} />;
    case 'tablas-edad':
      return <TablasEdadDelPlan plan={plan} editarPlan={editarPlan} soloLectura={soloLectura} />;
    case 'proveedores':
      return <ProveedoresPlanPanel planId={id} onCambio={onCambio} />;
    case 'descuentos-recargos':
      return <DescuentosRecargosPanel cramo={cramo} soloLectura={soloLectura} onCambio={onCambio} />;
    case 'condominio':
      // nest-api todavía no escribe la tarifa de condominio (PUT 501): solo consulta.
      return <CondominioPanel cramo={cramo} soloLectura onCambio={onCambio} />;
    case 'revision':
      return <RevisionPlanPanel planId={id} onIrSeccion={onIrSeccion} recargar={cambios} />;
    case 'tarifas':
      return (
        <SectionPanel title="Tarifas y tasas" description="Cada cobertura cobra según su tarifa del ramo. Debe haber una sola tasa vigente por tarifa: cotización y emisión toman la vigente y no miran sus fechas. Dos tasas vigentes duplican la prima y ninguna la pierde.">
          <ul className="space-y-2 text-xs">
            {coberturas.map((c) => (
              <li key={`${c.ccobertura}|${c.ctarifa}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
                <span>
                  <strong>{c.nombre}</strong> <span className="font-mono text-slate-500">({c.ccobertura} · tarifa {c.ctarifa})</span>
                </span>
                <span className="flex gap-3">
                  <Link className="text-indigo-700 underline-offset-2 hover:underline" to={`/sis2000/ramo/${cramo}/coberturas/${encodeURIComponent(c.ccobertura)}/tarifas`}>
                    Tarifas de la cobertura
                  </Link>
                  <Link
                    className="text-indigo-700 underline-offset-2 hover:underline"
                    to={`/sis2000/ramo/${cramo}/coberturas/${encodeURIComponent(c.ccobertura)}/tarifas/${encodeURIComponent(c.ctarifa)}/detalles`}
                  >
                    Tasas con vigencia
                  </Link>
                </span>
              </li>
            ))}
            {!coberturas.length && <li className="text-slate-500">El plan todavía no tiene coberturas.</li>}
          </ul>
        </SectionPanel>
      );
    default:
      return (
        <Alert variant="info">
          La sección «{infoSeccion(seccion).titulo}» todavía no tiene pantalla en el configurador.
        </Alert>
      );
  }
}

/** Tablas de tasas por edad que usa el plan (personas), por cobertura y parentesco. Se cambian desde «Coberturas». */
function TablasEdadDelPlan({ plan, editarPlan, soloLectura }: { plan: Fila | null; editarPlan: string; soloLectura: boolean }) {
  const usos = (Array.isArray(plan?.coberturas) ? (plan.coberturas as Fila[]) : []).flatMap((c) =>
    (Array.isArray(c.parentescos) ? (c.parentescos as Fila[]) : []).map((p) => ({
      ccobertura: txt(c.ccobertura),
      cparen: txt(p.cparen),
      ctablatar: txt(p.ctablatar),
    })),
  );
  const tablas = [...new Set(usos.map((u) => u.ctablatar).filter(Boolean))];
  return (
    <SectionPanel title="Tablas de edad" description="Tablas de prima o tasa por tramo de edad que usan las coberturas del plan; se asignan por parentesco en «Coberturas». Si una edad no cae en ningún tramo, esa persona queda con prima 0.">
      {tablas.length ? (
        <ul className="space-y-2 text-xs">
          {tablas.map((t) => (
            <li key={t} className="rounded-xl border border-slate-200 p-3">
              <strong className="font-mono">{t}</strong>
              <span className="ml-2 text-slate-600">
                usada en:{' '}
                {usos
                  .filter((u) => u.ctablatar === t)
                  .map((u) => `cobertura ${u.ccobertura} / parentesco ${u.cparen}`)
                  .join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Alert variant="warning">El plan no tiene tablas de edad asignadas: sin ellas no se puede cotizar.</Alert>
      )}
      {!soloLectura && <EnlaceEditar to={editarPlan} texto="Crear o cambiar tramos de una tabla" />}
    </SectionPanel>
  );
}

function EnlaceEditar({ to, texto }: { to: string; texto: string }) {
  return (
    <Link to={to} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 underline-offset-2 hover:underline">
      <ExternalLink className="h-3.5 w-3.5" />
      {texto} (asistente de planes)
    </Link>
  );
}
