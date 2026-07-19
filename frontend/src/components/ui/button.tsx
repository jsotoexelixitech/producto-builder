import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:hover:transform-none',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-500 text-white shadow-brand hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-8px_rgba(15,26,90,0.55)] active:translate-y-0 ring-1 ring-inset ring-white/10',
        outline:
          'border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-700 hover:-translate-y-0.5',
        ghost: 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700',
        destructive: 'bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-sm hover:-translate-y-0.5',
      },
      size: {
        default: 'h-10 px-5 py-2.5 text-sm',
        sm: 'h-8 px-3.5 py-2 text-xs',
        lg: 'h-11 px-6 py-3.5 text-sm',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';
