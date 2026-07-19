import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'flex h-auto min-h-[42px] w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200 outline-none hover:border-slate-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 data-[placeholder]:text-slate-300',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={cn(
          'z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg',
          className,
        )}
        position="popper"
        sideOffset={4}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-lg px-2.5 py-2 text-sm outline-none transition-colors data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-800 data-[state=checked]:font-semibold data-[state=checked]:text-indigo-700',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
