import { Link } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: React.ReactNode;
  actions?: React.ReactNode;
  backTo?: { href: string; label: string };
  title?: string;
  subtitle?: string;
  headerExtra?: React.ReactNode;
  maxWidth?: '5xl' | '6xl' | '7xl' | 'full';
  footer?: React.ReactNode;
  variant?: 'default' | 'flow';
  hideSidebar?: boolean;
}

export function AppShell({
  children,
  actions,
  backTo,
  title,
  subtitle,
  headerExtra,
  maxWidth = '7xl',
  footer,
  variant = 'default',
  hideSidebar = false,
}: AppShellProps) {
  const widthClass =
    maxWidth === 'full'
      ? 'max-w-none'
      : maxWidth === '7xl'
        ? 'max-w-7xl'
        : maxWidth === '5xl'
          ? 'max-w-5xl'
          : 'max-w-6xl';

  return (
    <div className={cn('app-shell', variant === 'flow' && 'app-shell-flow')}>
      {!hideSidebar && <AppSidebar />}

      <div className="app-shell-main">
        <header className="app-topbar">
          <div className={cn('flex w-full items-center justify-between gap-4', widthClass, 'mx-auto px-6')}>
            <div className="flex min-w-0 flex-1 items-center gap-4">
              {backTo ? (
                <Link to={backTo.href} className="app-back-link">
                  <span aria-hidden>←</span>
                  {backTo.label}
                </Link>
              ) : title ? (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{title}</p>
                  {subtitle && (
                    <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                  )}
                </div>
              ) : null}
              {headerExtra && (
                <div className="min-w-0 flex-1 border-l border-border/50 pl-4">{headerExtra}</div>
              )}
            </div>
            {actions && <div className="shrink-0">{actions}</div>}
          </div>
        </header>

        <main className={cn('app-content', widthClass, 'mx-auto w-full px-6 py-6')}>
          {children}
        </main>

        {footer && (
          <footer className="app-footer">
            <div className={cn('mx-auto px-6 py-4', widthClass)}>{footer}</div>
          </footer>
        )}
      </div>
    </div>
  );
}
