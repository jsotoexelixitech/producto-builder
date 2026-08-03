import {
  Calculator,
  Check,
  FileText,
  Layers,
  LayoutGrid,
  Route,
  Scale,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 'core', label: 'Producto', desc: 'Identificación y ramo', icon: Shield },
  { id: 'coverages', label: 'Coberturas', desc: 'Sumas y primas', icon: Layers },
  { id: 'plans', label: 'Planes', desc: 'Opciones comerciales', icon: LayoutGrid },
  { id: 'actuarial', label: 'Actuarial', desc: 'Tarificación', icon: Calculator },
  { id: 'legal', label: 'Legal', desc: 'Exclusiones y documentos', icon: FileText },
  { id: 'emission', label: 'Flujo emisión', desc: 'Pasos y formularios', icon: Route },
  { id: 'review', label: 'Activación', desc: 'Publicar producto', icon: Scale },
] as const;

interface StepperProps {
  current: number;
  variant?: 'horizontal' | 'vertical';
  onStepClick?: (step: number) => void;
}

function StepCircle({
  index,
  done,
  active,
  icon: Icon,
}: {
  index: number;
  done: boolean;
  active: boolean;
  icon: LucideIcon;
}) {
  return (
    <div
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-250',
        done && 'border-emerald-500 bg-emerald-500 text-white shadow-sm',
        active &&
          'scale-105 border-transparent bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-500 text-white shadow-[0_8px_20px_-6px_rgba(15,26,90,0.45)] ring-4 ring-indigo-100',
        !done && !active && 'border-slate-200 bg-white text-slate-400',
      )}
    >
      {done ? <Check className="h-4 w-4" /> : active ? <Icon className="h-4 w-4" /> : index + 1}
    </div>
  );
}

export function Stepper({ current, variant = 'horizontal', onStepClick }: StepperProps) {
  const progress = ((current + 1) / STEPS.length) * 100;

  if (variant === 'vertical') {
    return (
      <nav aria-label="Progreso del wizard" className="w-full">
        <div className="mb-4 lg:hidden">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">
              Paso {current + 1} de {STEPS.length}
            </span>
            <span className="text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <ol className="space-y-1">
          {STEPS.map((step, index) => {
            const done = index < current;
            const active = index === current;
            const clickable = done && onStepClick;

            return (
              <li key={step.id}>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onStepClick(index)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                    active && 'bg-indigo-50 ring-1 ring-indigo-200/70',
                    done && 'hover:bg-slate-50',
                    !done && !active && 'opacity-60',
                    clickable ? 'cursor-pointer' : 'cursor-default',
                  )}
                >
                  <StepCircle
                    index={index}
                    done={done}
                    active={active}
                    icon={step.icon}
                  />
                  <div className="min-w-0">
                    <p
                      className={cn(
                        'text-sm font-semibold',
                        active ? 'text-indigo-700' : done ? 'text-slate-800' : 'text-muted-foreground',
                      )}
                    >
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{step.desc}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  return (
    <nav aria-label="Progreso del wizard" className="w-full">
      <div className="mb-4 sm:hidden">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">
            {STEPS[current].label} · Paso {current + 1}/{STEPS.length}
          </span>
          <span className="text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <ol className="hidden items-center justify-between gap-1 sm:flex">
        {STEPS.map((step, index) => {
          const done = index < current;
          const active = index === current;
          const last = index === STEPS.length - 1;

          return (
            <li key={step.id} className="flex flex-1 items-center">
              <div className="flex min-w-0 flex-col items-center gap-2">
                <StepCircle
                  index={index}
                  done={done}
                  active={active}
                  icon={step.icon}
                />
                <div className="text-center">
                  <p
                    className={cn(
                      'text-xs font-semibold',
                      active ? 'text-indigo-700' : done ? 'text-emerald-600' : 'text-muted-foreground',
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="hidden text-[10px] text-muted-foreground md:block">{step.desc}</p>
                </div>
              </div>
              {!last && (
                <div
                  className={cn(
                    'mx-2 mb-8 h-0.5 flex-1 rounded-full transition-colors duration-300',
                    index < current ? 'bg-emerald-500' : 'bg-slate-200',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { STEPS };
