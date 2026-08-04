import { Link, useLocation } from 'react-router-dom';
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { publicAsset } from '@/lib/app-base';
import '@/styles/exelixi-emission.css';

interface EmissionShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  backTo?: { href: string; label: string };
  headerExtra?: React.ReactNode;
  footer?: React.ReactNode;
}

export function EmissionShell({
  children,
  title,
  subtitle,
  backTo,
  headerExtra,
  footer,
}: EmissionShellProps) {
  const { pathname } = useLocation();
  const isLauncher = pathname === '/emitir';

  return (
    <div className="exelixi-flow">
      <header className="exelixi-flow-header relative">
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link to="/emitir" className="shrink-0">
              <img
                src={publicAsset('branding/exelixi-logo-color.png')}
                alt="Exélixi technology"
                className="exelixi-flow-logo"
                draggable={false}
              />
            </Link>
            <div className="hidden min-w-0 sm:block">
              <span className="exelixi-flow-badge">Emisión genérica</span>
              {title && (
                <p className="mt-1 truncate text-sm font-semibold text-white">{title}</p>
              )}
              {subtitle && (
                <p className="truncate text-xs text-white/60">{subtitle}</p>
              )}
            </div>
          </div>

          <nav className="flex items-center gap-4 sm:gap-6">
            <Link
              to="/emitir"
              className={cn(
                'exelixi-flow-nav-link',
                isLauncher && 'exelixi-flow-nav-link-active',
              )}
            >
              Ramos
            </Link>
            <Link to="/" className="exelixi-flow-nav-link inline-flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Catálogo</span>
            </Link>
          </nav>
        </div>

        {(backTo || headerExtra) && (
          <div className="relative border-t border-white/10 bg-black/15">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
              {backTo && (
                <Link
                  to={backTo.href}
                  className="text-xs font-bold uppercase tracking-wide text-white/70 hover:text-[#f27121]"
                >
                  ← {backTo.label}
                </Link>
              )}
              {headerExtra && <div className="min-w-0 flex-1">{headerExtra}</div>}
            </div>
          </div>
        )}
      </header>

      <main className="exelixi-flow-main">{children}</main>

      {footer && <footer className="exelixi-footer-bar">{footer}</footer>}
    </div>
  );
}
