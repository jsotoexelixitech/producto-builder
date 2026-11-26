import { useState, type ReactNode } from 'react';

/** Una línea corta y, debajo, «Ver más» con el resto del texto. Solo en la vista moderna. */
export function TextoPlegable({ activo, corto, children }: { activo: boolean; corto: string; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  if (!activo) return <>{children}</>;
  return (
    <div className="cb-plegable">
      <p className="cb-plegable-corto">
        {corto}{' '}
        <button type="button" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
          {abierto ? 'Ver menos' : 'Ver más'}
        </button>
      </p>
      {abierto && <div className="cb-plegable-resto">{children}</div>}
    </div>
  );
}
