import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useBlocker } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Aviso al salir con cambios sin guardar. Bloquea la navegación interna (useBlocker, requiere el router de datos de
 * main.tsx) y el cierre/recarga de la pestaña (beforeunload). Se muestra un diálogo con la marca; si el usuario
 * confirma, la navegación sigue.
 *
 * - `sucio`: hay cambios sin guardar.
 * - `permitirSalida(fn)`: ejecuta fn (p. ej. guardar) con la salida libre: así un navigate() posterior al guardado
 *   no pregunta aunque el estado de React aún no se haya redibujado.
 */
export function useAvisoSinGuardar(sucio: boolean): {
  dialogo: ReactNode;
  permitirSalida: <T>(fn: () => Promise<T> | T) => Promise<T>;
} {
  const libre = useRef(0);
  const sucioRef = useRef(sucio);
  sucioRef.current = sucio;

  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }: { currentLocation: { pathname: string }; nextLocation: { pathname: string } }) =>
        sucioRef.current && libre.current === 0 && currentLocation.pathname !== nextLocation.pathname,
      [],
    ),
  );

  useEffect(() => {
    if (!sucio) return;
    const alSalir = (e: BeforeUnloadEvent) => {
      if (libre.current > 0) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', alSalir);
    return () => window.removeEventListener('beforeunload', alSalir);
  }, [sucio]);

  const permitirSalida = useCallback(async <T,>(fn: () => Promise<T> | T): Promise<T> => {
    libre.current += 1;
    try {
      return await fn();
    } finally {
      libre.current -= 1;
    }
  }, []);

  const abierto = blocker.state === 'blocked';
  const dialogo = (
    <Dialog.Root open={abierto} onOpenChange={(o) => !o && blocker.state === 'blocked' && blocker.reset()}>
      <Dialog.Portal>
        <Dialog.Overlay className="lm-overlay fixed inset-0 z-[110] bg-slate-900/40" />
        <Dialog.Content className="lm-dialogo fixed left-1/2 top-1/2 z-[120] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-2xl outline-none">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <Dialog.Title className="lm-dialogo-titulo text-base font-bold text-slate-900">
                Tienes cambios sin guardar
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-slate-600">
                Si sales ahora se pierde lo que cambiaste en esta pantalla. ¿Quieres seguir editando o salir sin guardar?
              </Dialog.Description>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => blocker.state === 'blocked' && blocker.proceed()}>
              Salir sin guardar
            </Button>
            <Button type="button" size="sm" onClick={() => blocker.state === 'blocked' && blocker.reset()} autoFocus>
              Seguir editando
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );

  return { dialogo, permitirSalida };
}

/**
 * Detecta cambios comparando `valor` con una base: la base es el primer valor no vacío una vez que `listo` es true.
 * `marcarGuardado()` adopta el valor actual como nueva base; `adoptarProximoCambio()` adopta el siguiente valor
 * (para cuando los datos se recargan solos, p. ej. al restaurar una versión del historial).
 */
export function useCambiosSinGuardar(valor: string, listo: boolean): {
  sucio: boolean;
  marcarGuardado: () => void;
  adoptarProximoCambio: () => void;
} {
  const [base, setBase] = useState<string | null>(null);
  const valorRef = useRef(valor);
  valorRef.current = valor;
  const adoptar = useRef(false);

  useEffect(() => {
    if (!listo) {
      setBase(null);
      return;
    }
    if (base === null && valor !== '') setBase(valor);
    else if (adoptar.current && valor !== base) {
      adoptar.current = false;
      setBase(valor);
    }
  }, [valor, listo, base]);

  return {
    sucio: listo && base !== null && valor !== base,
    marcarGuardado: useCallback(() => setBase(valorRef.current), []),
    adoptarProximoCambio: useCallback(() => {
      adoptar.current = true;
    }, []),
  };
}
