import { cn } from '@/lib/utils';

interface ToggleFieldProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
}

export function ToggleField({
  id,
  label,
  description,
  checked,
  onChange,
  className,
  disabled = false,
}: ToggleFieldProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4 transition-all duration-300',
        disabled && 'opacity-60',
        checked
          ? 'border-indigo-200/70 bg-gradient-to-br from-indigo-50 to-violet-50'
          : 'border-slate-200 bg-slate-50',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'text-sm font-bold',
              checked ? 'text-indigo-900' : 'text-slate-700',
            )}
          >
            {label}
          </p>
          {description && (
            <p
              className={cn(
                'mt-1 text-[0.78rem] leading-relaxed',
                checked ? 'text-indigo-700/80' : 'text-slate-500',
              )}
            >
              {description}
            </p>
          )}
        </div>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => !disabled && onChange(!checked)}
          className={cn(
            'relative h-7 w-12 shrink-0 rounded-full outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2',
            checked
              ? 'bg-gradient-to-r from-indigo-500 to-violet-500 shadow-[0_4px_14px_rgba(15,26,90,0.35)]'
              : 'bg-slate-300',
            disabled ? 'cursor-not-allowed' : 'cursor-pointer',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-300 ease-out',
              checked ? 'translate-x-5' : 'translate-x-0',
            )}
          />
        </button>
      </div>
    </div>
  );
}
