import { Link, useLocation } from 'react-router-dom';
import { Eye, Layers, Plus, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Productos', icon: Layers, match: (p: string) => p === '/' },
  { href: '/products/new', label: 'Nuevo producto', icon: Plus, match: (p: string) => p.startsWith('/products/new') },
];

export function AppSidebar() {
  const { pathname } = useLocation();
  const isPreview = pathname.includes('/preview');

  return (
    <aside className="app-sidebar">
      <Link to="/" className="app-sidebar-brand">
        <div className="app-sidebar-logo">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight">Product Builder</p>
          <p className="truncate text-[11px] text-slate-400">La Mundial · SUDEASEG</p>
        </div>
      </Link>

      <nav className="app-sidebar-nav">
        <p className="app-sidebar-section">Configuración</p>
        {NAV.map(({ href, label, icon: Icon, match }) => (
          <Link
            key={href}
            to={href}
            className={cn('app-sidebar-link', match(pathname) && !isPreview && 'app-sidebar-link-active')}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}

        {isPreview && (
          <>
            <p className="app-sidebar-section mt-4">Vista previa</p>
            <span className="app-sidebar-link app-sidebar-link-active">
              <Eye className="h-4 w-4 shrink-0" />
              Flujo de emisión
            </span>
          </>
        )}
      </nav>

      <div className="app-sidebar-footer">
        <p className="text-[11px] leading-relaxed text-slate-500">
          Sistema independiente. SISIP/SIS2000 solo como referencia de datos.
        </p>
      </div>
    </aside>
  );
}
