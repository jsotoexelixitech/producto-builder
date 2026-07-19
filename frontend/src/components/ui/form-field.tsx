import { cn } from '@/lib/utils';

interface FormFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
  span?: 1 | 2;
}

export function FormField({
  label,
  hint,
  error,
  htmlFor,
  className,
  children,
  span = 1,
}: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', span === 2 && 'sm:col-span-2', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-[0.78rem] font-bold tracking-wide text-slate-600"
        >
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-[0.72rem] font-semibold text-rose-500">
          <span className="h-1 w-1 rounded-full bg-rose-500" />
          {error}
        </p>
      ) : (
        hint && <p className="text-[0.72rem] leading-relaxed text-slate-500">{hint}</p>
      )}
    </div>
  );
}

export function FormGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2', className)}>{children}</div>;
}
