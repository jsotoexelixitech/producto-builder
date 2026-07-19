import * as React from 'react';
import { cn } from '@/lib/utils';

const inputBase =
  'flex w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-300 hover:border-slate-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input type={type} className={cn(inputBase, 'h-auto', className)} ref={ref} {...props} />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(inputBase, 'min-h-[100px] resize-none', className)}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
