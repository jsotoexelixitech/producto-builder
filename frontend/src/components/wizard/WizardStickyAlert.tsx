import { AlertCircle, X } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WizardStickyAlertProps {
  message: string;
  onDismiss?: () => void;
  className?: string;
}

export function WizardStickyAlert({ message, onDismiss, className }: WizardStickyAlertProps) {
  if (!message.trim()) return null;

  return (
    <div
      className={cn(
        'sticky top-16 z-40 -mx-2 mb-4 sm:-mx-0 sm:top-20',
        className,
      )}
      role="alert"
    >
      <Alert variant="error" className="shadow-lg ring-1 ring-destructive/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="min-w-0 flex-1 text-sm leading-relaxed">{message}</p>
          {onDismiss && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 shrink-0 p-0"
              onClick={onDismiss}
              aria-label="Cerrar aviso"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </Alert>
    </div>
  );
}
