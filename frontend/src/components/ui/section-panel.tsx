import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionPanelProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}

export function SectionPanel({
  title,
  description,
  icon: Icon,
  children,
  className,
}: SectionPanelProps) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors hover:border-slate-300',
        className,
      )}
    >
      <div className="flex items-start gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
        {Icon && (
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 shadow-sm">
            <Icon className="h-4 w-4 text-white" />
          </div>
        )}
        <div className="min-w-0">
          <h4 className="font-display text-[0.95rem] font-bold tracking-tight text-slate-900">
            {title}
          </h4>
          {description && (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
          )}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
