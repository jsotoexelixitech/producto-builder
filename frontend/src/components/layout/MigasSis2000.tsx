import { Fragment, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatNestRowValue, formatTarifaDescripcion } from '@/lib/sis2000-nest-api';
import { clavesDeRuta, construirMigas, type NombresMigas } from '@/lib/migas';

/** Caché de nombres legibles por sesión (evita repetir consultas al navegar entre niveles). */
const cache = new Map<string, string>();
let ramosPromesa: Promise<void> | null = null;

function cargarRamos(): Promise<void> {
  if (!ramosPromesa) {
    ramosPromesa = api
      .listSis2000Ramos()
      .then((rs) => {
        for (const r of Array.isArray(rs) ? rs : []) cache.set(`r:${r.cramo}`, String(r.xdescripcion ?? '').trim());
      })
      .catch(() => {
        ramosPromesa = null;
      });
  }
  return ramosPromesa;
}

const limpio = (v: unknown) => {
  const t = formatNestRowValue(v as never);
  return t === '—' ? '' : String(t).trim();
};

/**
 * Migas de pan de las rutas /sis2000/... Se muestra arriba (dentro de la barra fija). Los nombres legibles se buscan
 * en segundo plano; mientras llegan (o si fallan) se ve el código.
 */
export function MigasSis2000() {
  const { pathname } = useLocation();
  const { cramo, ccobertura, ctarifa } = clavesDeRuta(pathname);
  const [, redibujar] = useState(0);

  useEffect(() => {
    let vivo = true;
    const listo = () => vivo && redibujar((n) => n + 1);
    const n = Number(cramo);
    if (cramo && !cache.has(`r:${cramo}`)) void cargarRamos().then(listo);
    if (cramo && ccobertura && ccobertura !== 'new' && !cache.has(`c:${cramo}:${ccobertura}`)) {
      api
        .getSis2000Cobertura(n, ccobertura)
        .then((row) => {
          cache.set(`c:${cramo}:${ccobertura}`, limpio(row.xdescripcion_l ?? row.xcobertura));
          listo();
        })
        .catch(() => undefined);
    }
    if (cramo && ccobertura && ctarifa && ctarifa !== 'new' && !cache.has(`t:${cramo}:${ccobertura}:${ctarifa}`)) {
      api
        .listSis2000Tarifas(n, ccobertura)
        .then((rows) => {
          const fila = rows.find((t) => String(t.ctarifa ?? '') === ctarifa);
          if (fila) cache.set(`t:${cramo}:${ccobertura}:${ctarifa}`, limpio(formatTarifaDescripcion(fila)));
          listo();
        })
        .catch(() => undefined);
    }
    return () => {
      vivo = false;
    };
  }, [cramo, ccobertura, ctarifa]);

  const nombres: NombresMigas = {
    ramo: cramo ? cache.get(`r:${cramo}`) || undefined : undefined,
    cobertura: cramo && ccobertura ? cache.get(`c:${cramo}:${ccobertura}`) || undefined : undefined,
    tarifa: cramo && ccobertura && ctarifa ? cache.get(`t:${cramo}:${ccobertura}:${ctarifa}`) || undefined : undefined,
  };
  const migas = construirMigas(pathname, nombres);
  if (migas.length < 2) return null;

  return (
    <nav aria-label="Ruta de navegación" className="app-migas">
      <ol>
        {migas.map((m, i) => (
          <Fragment key={`${i}-${m.label}`}>
            <li>
              {m.href ? (
                <Link to={m.href} title={m.label}>
                  {m.label}
                </Link>
              ) : (
                <span aria-current="page" title={m.label}>
                  {m.label}
                </span>
              )}
            </li>
            {i < migas.length - 1 && <ChevronRight className="app-migas-sep" aria-hidden="true" />}
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
