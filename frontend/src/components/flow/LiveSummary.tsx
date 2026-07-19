import { AlertTriangle } from 'lucide-react';
import type { FlowStepDefinition, SummaryLine } from '@/lib/emission-flow';
import { cn } from '@/lib/utils';

interface LiveSummaryProps {
  title?: string;
  lines: SummaryLine[];
  total: string;
  paymentBlockedReason?: string | null;
  steps?: FlowStepDefinition[];
  currentStepIndex?: number;
}

export function LiveSummary({
  title = 'Resumen vivo',
  lines,
  total,
  paymentBlockedReason,
  steps,
  currentStepIndex = 0,
}: LiveSummaryProps) {
  return (
    <aside className="live-summary">
      <p className="live-summary-title">{title}</p>

      <dl className="live-summary-list">
        {lines.map((line) => (
          <div key={line.label} className="live-summary-row">
            <dt>{line.label}</dt>
            <dd className={cn(line.highlight && 'font-semibold text-foreground')}>{line.value}</dd>
          </div>
        ))}
      </dl>

      <div className="live-summary-total">
        <span className="live-summary-total-label">Total estimado</span>
        <span className="live-summary-total-value tabular-nums">{total}</span>
      </div>

      {paymentBlockedReason && (
        <div className="live-summary-alert">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Pago bloqueado</p>
            <p className="mt-0.5 text-xs leading-relaxed opacity-90">{paymentBlockedReason}</p>
          </div>
        </div>
      )}

      {steps && steps.length > 0 && (
        <div className="live-summary-milestones">
          {steps.map((step, i) => (
            <div
              key={step.id}
              className={cn(
                'live-summary-milestone',
                i < currentStepIndex && 'live-summary-milestone-done',
                i === currentStepIndex && 'live-summary-milestone-active',
              )}
            >
              <span className="live-summary-dot" />
              <span>{step.shortLabel}</span>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
