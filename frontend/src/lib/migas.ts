/** Migas de pan de las rutas /sis2000/...: pura (sin React ni red) para poder probarla. */

export interface Miga {
  label: string;
  /** Sin href = nivel actual (no es enlace). */
  href?: string;
}

/** Nombres legibles ya conocidos; si falta alguno se muestra el código. */
export interface NombresMigas {
  ramo?: string;
  cobertura?: string;
  tarifa?: string;
}

export interface ClavesMigas {
  cramo: string | null;
  ccobertura: string | null;
  ctarifa: string | null;
}

/** Códigos presentes en la ruta (decodificados). */
export function clavesDeRuta(pathname: string): ClavesMigas {
  const m = /\/sis2000\/ramo\/([^/]+)(?:\/coberturas\/([^/]+)(?:\/tarifas\/([^/]+))?)?/.exec(pathname);
  const dec = (s?: string) => {
    if (!s) return null;
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  };
  return { cramo: dec(m?.[1]), ccobertura: dec(m?.[2]), ctarifa: dec(m?.[3]) };
}

const NUEVO: Record<string, string> = { coberturas: 'Nueva cobertura', tarifas: 'Nueva tarifa', detalles: 'Nuevo detalle' };
const EDITAR: Record<string, string> = { coberturas: 'Editar cobertura', tarifas: 'Editar tarifa' };

/** Devuelve [] si la ruta no está bajo /sis2000 o es la raíz (no hace falta migas). */
export function construirMigas(pathname: string, nombres: NombresMigas = {}): Miga[] {
  const p = pathname.replace(/\/+$/, '');
  if (!p.startsWith('/sis2000') || p === '/sis2000') return [];
  const migas: Miga[] = [{ label: 'Sis2000', href: '/sis2000' }];
  const partes = p.split('/').filter(Boolean).slice(1); // sin "sis2000"
  const push = (label: string, href: string) => migas.push({ label, href });

  if (partes[0] === 'ramos') {
    push('Ramos', '/sis2000/ramos');
  } else if (partes[0] === 'combos') {
    push('Combos de coberturas', '/sis2000/combos');
  } else if (partes[0] === 'plans') {
    push('Planes', '/sis2000/plans');
    const id = partes[1];
    if (id === 'new') push('Nuevo plan', p);
    else if (id) {
      push(`Plan ${decodeURIComponent(id)}`, `/sis2000/plans/${id}/configurar`);
      const accion = partes[2];
      if (accion === 'edit') push('Editar', p);
      else if (accion === 'json') push('Modo avanzado', p);
      else if (accion === 'configurar') push('Configurar', p);
    }
  } else if (partes[0] === 'ramo') {
    const { cramo, ccobertura, ctarifa } = clavesDeRuta(p);
    push('Ramos', '/sis2000/ramos');
    if (cramo) {
      const baseRamo = `/sis2000/ramo/${cramo}`;
      push(nombres.ramo ? `${nombres.ramo} (${cramo})` : `Ramo ${cramo}`, `${baseRamo}/coberturas`);
      if (ccobertura && ccobertura !== 'new') {
        const baseCob = `${baseRamo}/coberturas/${encodeURIComponent(ccobertura)}`;
        push(nombres.cobertura ? `${nombres.cobertura}` : `Cobertura ${ccobertura}`, `${baseCob}/tarifas`);
        if (ctarifa && ctarifa !== 'new') {
          const baseTar = `${baseCob}/tarifas/${encodeURIComponent(ctarifa)}`;
          push(nombres.tarifa ? nombres.tarifa : `Tarifa ${ctarifa}`, `${baseTar}/detalles`);
        }
      } else {
        push('Coberturas', `${baseRamo}/coberturas`);
      }
    }
    // Último tramo de la ruta: acción o listado.
    const ult = partes[partes.length - 1];
    const penult = partes[partes.length - 2];
    if (ult === 'new') {
      migas.push({ label: NUEVO[penult ?? ''] ?? 'Nuevo' });
    } else if (ult === 'edit') {
      migas.push({ label: EDITAR[partes[partes.length - 3] ?? ''] ?? 'Editar' });
    } else if (ult === 'detalles') {
      migas.push({ label: 'Detalles' });
    } else if (ult === 'tarifas') {
      migas.push({ label: 'Tarifas' });
    } else if (ult === 'coberturas') {
      migas.push({ label: 'Coberturas' });
    }
  } else if (partes[0] === 'new') {
    push('Nuevo producto', p);
  } else if (partes[0]) {
    push(`Producto ${decodeURIComponent(partes[0])}`, p);
  }

  // El último nivel es la página actual: sin enlace. Evita duplicar etiqueta repetida.
  const dedup: Miga[] = [];
  for (const m of migas) {
    if (dedup.length && dedup[dedup.length - 1].label === m.label) continue;
    dedup.push(m);
  }
  const ultima = dedup[dedup.length - 1];
  dedup[dedup.length - 1] = { label: ultima.label };
  return dedup;
}
