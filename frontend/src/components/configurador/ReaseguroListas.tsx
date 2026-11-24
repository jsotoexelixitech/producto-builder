import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export const LISTA_CONTRATOS_REASEGURO = 'lista-contratos-reaseguro';
export const LISTA_RAMOS_REASEGURO = 'lista-ramos-reaseguro';

type Opcion = { codigo: string; nombre: string };

const texto = (v: unknown) => String(v ?? '').trim();

/**
 * Sugerencias para los campos de reaseguro (contrato y ramo de reaseguro): <datalist> con macontratos y maramosrea
 * leídos de nest-api (GET configurador/reaseguro). Los inputs las usan con `list={LISTA_...}`. Si el catálogo no carga,
 * los campos siguen siendo de texto libre (nest-api igual valida que existan).
 */
export function ReaseguroListas() {
  const [contratos, setContratos] = useState<Opcion[]>([]);
  const [ramos, setRamos] = useState<Opcion[]>([]);

  useEffect(() => {
    let vivo = true;
    api
      .listSis2000CatalogContratosReaseguro()
      .then((filas) => vivo && setContratos(filas.map((f) => ({ codigo: texto(f.ccont), nombre: texto(f.xdescripcion) })).filter((o) => o.codigo)))
      .catch(() => undefined);
    api
      .listSis2000CatalogRamosReaseguro()
      .then((filas) => vivo && setRamos(filas.map((f) => ({ codigo: texto(f.cramorea), nombre: texto(f.xdescripcion) })).filter((o) => o.codigo)))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <>
      <datalist id={LISTA_CONTRATOS_REASEGURO}>
        {contratos.map((o) => (
          <option key={o.codigo} value={o.codigo}>
            {o.nombre}
          </option>
        ))}
      </datalist>
      <datalist id={LISTA_RAMOS_REASEGURO}>
        {ramos.map((o) => (
          <option key={o.codigo} value={o.codigo}>
            {o.nombre}
          </option>
        ))}
      </datalist>
    </>
  );
}
