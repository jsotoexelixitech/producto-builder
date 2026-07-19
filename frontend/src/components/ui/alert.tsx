import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type AlertVariant = 'error' | 'success' | 'warning' | 'info';

const styles: Record<AlertVariant, string> = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
};

const icons: Record<AlertVariant, typeof Info> = {
  error: AlertCircle,
  success: CheckCircle2,
  warning: AlertCircle,
  info: Info,
};

export function Alert({
  variant = 'info',
  children,
  className,
}: {
  variant?: AlertVariant;
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = icons[variant];
  return (
    <div className={cn('alert-banner', styles[variant], className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">{children}</div>
    </div>
  );
}
