import { Check } from 'lucide-react';
import type { FlowStepDefinition } from '@/lib/emission-flow';
import { cn } from '@/lib/utils';

interface FlowStepperProps {
  steps: FlowStepDefinition[];
  currentIndex: number;
  completedThrough?: number;
  onStepClick?: (index: number) => void;
  compact?: boolean;
}

export function FlowStepper({
  steps,
  currentIndex,
  completedThrough = -1,
  onStepClick,
  compact = false,
}: FlowStepperProps) {
  return (
    <div className={cn('flow-stepper', compact && 'flow-stepper-compact')}>
      <div className="flow-stepper-track">
        {steps.map((step, index) => {
          const isComplete = index < currentIndex || index <= completedThrough;
          const isCurrent = index === currentIndex;
          const isClickable = !!onStepClick && (isComplete || isCurrent);

          return (
            <button
              key={step.id}
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepClick?.(index)}
              className={cn(
                'flow-step',
                isCurrent && 'flow-step-current',
                isComplete && 'flow-step-complete',
                !isClickable && 'flow-step-disabled',
              )}
            >
              <span className="flow-step-circle">
                {isComplete && !isCurrent ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                ) : (
                  step.number
                )}
              </span>
              <span className="flow-step-label">{compact ? step.shortLabel : step.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
