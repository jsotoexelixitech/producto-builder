import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        draft: 'border-slate-300 bg-slate-100 text-slate-700',
        actuarial: 'border-amber-300 bg-amber-50 text-amber-800',
        submitted: 'border-blue-300 bg-blue-50 text-blue-800',
        approved: 'border-emerald-300 bg-emerald-50 text-emerald-800',
        rejected: 'border-red-300 bg-red-50 text-red-800',
        default: 'border-border bg-muted text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function statusBadgeVariant(
  status: string,
): VariantProps<typeof badgeVariants>['variant'] {
  const map: Record<string, VariantProps<typeof badgeVariants>['variant']> = {
    DRAFT: 'draft',
    ACTUARIAL_REVIEW: 'actuarial',
    SUBMITTED_TO_SUDEASEG: 'submitted',
    APPROVED_ACTIVE: 'approved',
    REJECTED: 'rejected',
  };
  return map[status] ?? 'default';
}
