import { Link, useLocation } from 'react-router-dom';
import { Database, Eye, Layers, LogOut, Plus, Shield } from 'lucide-react';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Productos', icon: Layers, match: (p: string) => p === '/' },
  { href: '/products/new', label: 'Nuevo producto', icon: Plus, match: (p: string) => p.startsWith('/products/new') },
  { href: '/sis2000', label: 'Sis2000 QA', icon: Database, match: (p: string) => p.startsWith('/sis2000') },
];
export function AppSidebar() {
  const pathname = useLocation().pathname;
  const isPreview = pathname.includes('/preview');
  const user = getStoredUser();

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
            className={cn(
              'app-sidebar-link',
              match(pathname) && !isPreview && 'app-sidebar-link-active',
            )}
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

      <div className="app-sidebar-footer space-y-3">
        {user && (
          <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-2">
            <p className="truncate text-xs font-medium text-slate-200">{user.fullName}</p>
            <p className="truncate text-[10px] text-slate-400">{user.email}</p>
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start text-slate-400 hover:text-white"
          onClick={() => api.logout()}
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );
}
