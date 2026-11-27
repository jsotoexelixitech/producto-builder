import { Suspense, lazy, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Network, X } from 'lucide-react';
import type { DatosMapa } from '@/lib/ayudas/mapa-plan';

// xyflow (y recharts) se bajan recién al abrir «Ver mapa».
const MapaPlan = lazy(() => import('./MapaPlan'));

export function BotonMapa({ datos }: { datos: DatosMapa }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Dialog.Root open={abierto} onOpenChange={setAbierto}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 outline-none transition-colors hover:bg-indigo-100 focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <Network className="h-3.5 w-3.5" aria-hidden />
          Ver mapa
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="lm-overlay fixed inset-0 z-[110] bg-slate-900/40" />
        <Dialog.Content className="lm-dialogo ayuda-contenido fixed left-1/2 top-1/2 z-[120] flex h-[min(34rem,calc(100vh-2rem))] w-[min(60rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-2xl bg-white p-4 shadow-2xl outline-none">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="lm-dialogo-titulo text-sm font-bold text-slate-900">Mapa del plan</Dialog.Title>
              <Dialog.Description className="text-xs text-slate-500">Producto, plan, coberturas y cómo se cobra cada una.</Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Cerrar el mapa"
              className="rounded-md p-1 text-slate-500 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <X className="h-4 w-4" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1">
            <Suspense fallback={<p className="p-4 text-xs text-slate-500">Cargando el mapa…</p>}>
              {abierto && <MapaPlan datos={datos} />}
            </Suspense>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
