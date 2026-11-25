import { useMemo } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { comandosDisponibles, type Comando } from '@/lib/ayudas/busqueda';

/** Cuadro del buscador Ctrl+K (cmdk). Lee lo que la pantalla abierta registró; no llama al servidor. */
export default function BuscadorDialogo({ abierto, onCambio }: { abierto: boolean; onCambio: (v: boolean) => void }) {
  const navigate = useNavigate();
  // Se vuelve a leer cada vez que se abre.
  const comandos = useMemo(() => (abierto ? comandosDisponibles() : []), [abierto]);
  const grupos = [...new Set(comandos.map((c) => c.grupo))];

  function elegir(c: Comando) {
    onCambio(false);
    if (c.ejecutar) c.ejecutar();
    else if (c.ruta) navigate(c.ruta);
  }

  return (
    <Command.Dialog
      open={abierto}
      onOpenChange={onCambio}
      label="Buscar pantallas y pasos"
      overlayClassName="fixed inset-0 z-[110] bg-slate-900/40"
      contentClassName="ayuda-contenido fixed left-1/2 top-[15vh] z-[120] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl outline-none"
    >
      <Command.Input
        placeholder="Buscar una pantalla, un paso o un ramo…"
        className="w-full border-b border-slate-100 px-4 py-3 text-sm outline-none placeholder:text-slate-400"
      />
      <Command.List className="max-h-[50vh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-xs text-slate-500">No hay resultados.</Command.Empty>
        {grupos.map((g) => (
          <Command.Group key={g} heading={g} className="mb-1 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1">
            {comandos
              .filter((c) => c.grupo === g)
              .map((c) => (
                <Command.Item
                  key={c.id}
                  value={`${c.titulo} ${c.detalle ?? ''} ${c.id}`}
                  onSelect={() => elegir(c)}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm normal-case tracking-normal text-slate-800 aria-selected:bg-indigo-50 aria-selected:text-indigo-800"
                >
                  <span>{c.titulo}</span>
                  {c.detalle && <span className="text-xs text-slate-400">{c.detalle}</span>}
                </Command.Item>
              ))}
          </Command.Group>
        ))}
      </Command.List>
      <p className="border-t border-slate-100 px-4 py-2 text-[0.7rem] text-slate-400">Flechas para moverte, Enter para ir, Esc para cerrar.</p>
    </Command.Dialog>
  );
}
