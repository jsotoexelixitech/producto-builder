import { useState } from 'react';
import { Compass } from 'lucide-react';
import { guiaYaVista, marcarGuiaVista, pasosGuiaDisponibles } from '@/lib/ayudas/guia';

function almacen(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Abre el recorrido guiado (driver.js se carga recién al pedirlo). */
async function iniciarGuia() {
  const [{ driver }] = await Promise.all([import('driver.js'), import('driver.js/dist/driver.css')]);
  const pasos = pasosGuiaDisponibles((s) => Boolean(document.querySelector(s)));
  if (!pasos.length) return;
  let sinMovimiento = false;
  try {
    sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    // sin matchMedia: con animación
  }
  const guia = driver({
    showProgress: true,
    animate: !sinMovimiento,
    smoothScroll: !sinMovimiento,
    allowClose: true,
    nextBtnText: 'Siguiente',
    prevBtnText: 'Atrás',
    doneBtnText: 'Listo',
    progressText: '{{current}} de {{total}}',
    steps: pasos.map((p) => ({ element: p.selector, popover: { title: p.titulo, description: p.texto } })),
    onDestroyed: () => marcarGuiaVista(almacen()),
  });
  guia.drive();
}

/** «Ver guía» + oferta de la primera vez (se puede descartar; nunca arranca sola). */
export function GuiaCombo() {
  const [oferta, setOferta] = useState(() => !guiaYaVista(almacen()));
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => {
          setOferta(false);
          void iniciarGuia();
        }}
        className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 outline-none transition-colors hover:bg-indigo-100 focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <Compass className="h-3.5 w-3.5" aria-hidden />
        Ver guía
      </button>
      {oferta && (
        <div className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-900" role="note">
          <p>¿Primera vez aquí? La guía te enseña en un minuto para qué sirve cada parte.</p>
          <button
            type="button"
            onClick={() => {
              marcarGuiaVista(almacen());
              setOferta(false);
            }}
            className="mt-1 font-semibold underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            No, gracias
          </button>
        </div>
      )}
    </div>
  );
}
