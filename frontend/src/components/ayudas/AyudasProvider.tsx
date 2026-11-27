import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AYUDAS_DISPONIBLES } from '@/lib/ayudas/flag';
import { guardarPreferenciaAyudas, leerPreferenciaAyudas } from '@/lib/ayudas/preferencia';
import './ayudas.css';
import './moderna.css';
import './moderna-lm.css';
import './moderna-centro.css';
import './moderna-contenido.css';

interface ValorAyudas {
  /** false = apagado en el build (VITE_UI_AYUDAS=0): no hay interruptor ni nada nuevo. */
  disponible: boolean;
  /** true = «Vista con ayudas». */
  activas: boolean;
  setActivas: (v: boolean) => void;
}

const SIN_AYUDAS: ValorAyudas = { disponible: false, activas: false, setActivas: () => undefined };
const Contexto = createContext<ValorAyudas>(SIN_AYUDAS);

function almacen(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function AyudasProvider({ children }: { children: ReactNode }) {
  const [activas, setActivasEstado] = useState(() => (AYUDAS_DISPONIBLES ? leerPreferenciaAyudas(almacen()) : false));
  const setActivas = useCallback((v: boolean) => {
    setActivasEstado(v);
    guardarPreferenciaAyudas(almacen(), v);
  }, []);
  const valor = useMemo<ValorAyudas>(
    () => (AYUDAS_DISPONIBLES ? { disponible: true, activas, setActivas } : SIN_AYUDAS),
    [activas, setActivas],
  );
  // Marca el body en Moderna: los diálogos (portales) viven fuera del shell y toman su estilo de esta clase.
  useEffect(() => {
    document.body.classList.toggle('lm-moderna', valor.activas);
    return () => document.body.classList.remove('lm-moderna');
  }, [valor.activas]);
  return (
    <Contexto.Provider value={valor}>
      {children}
      {valor.activas && <Toaster position="bottom-right" closeButton richColors duration={5000} />}
    </Contexto.Provider>
  );
}

export function useAyudas(): ValorAyudas {
  return useContext(Contexto);
}
