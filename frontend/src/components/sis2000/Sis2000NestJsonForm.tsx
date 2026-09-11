import { Link } from 'react-router-dom';
import { ArrowLeft, FileJson, Save } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

interface Sis2000NestJsonFormProps {
  title: string;
  subtitle: string;
  backHref: string;
  backLabel: string;
  jsonText: string;
  onJsonChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  loading?: boolean;
  error: string | null;
  success: string | null;
  saveLabel: string;
  onLoadDefinicion?: () => void;
  loadingDefinicion?: boolean;
  definicionHint?: string;
  toolbar?: React.ReactNode;
}

export function Sis2000NestJsonForm({
  title,
  subtitle,
  backHref,
  backLabel,
  jsonText,
  onJsonChange,
  onSave,
  saving,
  loading = false,
  error,
  success,
  saveLabel,
  onLoadDefinicion,
  loadingDefinicion = false,
  definicionHint,
  toolbar,
}: Sis2000NestJsonFormProps) {
  return (
    <AppShell title={title}>
      <Link
        to={backHref}
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {backLabel}
      </Link>

      <h1 className="mb-1 text-lg font-bold">{title}</h1>
      <p className="mb-1 text-xs text-muted-foreground">{subtitle}</p>
      <p className="mb-4 text-xs text-amber-800 dark:text-amber-200">
        Mantenimiento de catálogo Sis2000 — no emite pólizas.
      </p>

      {error && <Alert variant="error" className="mb-3">{error}</Alert>}
      {success && <Alert variant="success" className="mb-3">{success}</Alert>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {onLoadDefinicion && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLoadDefinicion}
            disabled={loadingDefinicion || loading}
          >
            <FileJson className="h-3.5 w-3.5" />
            {loadingDefinicion ? 'Cargando…' : 'Ver definición campos'}
          </Button>
        )}
        {toolbar}
      </div>

      {definicionHint && (
        <p className="mb-2 text-xs text-muted-foreground">{definicionHint}</p>
      )}

      {loading ? (
        <div className="mb-4 min-h-[420px] animate-pulse rounded-lg bg-muted/60" />
      ) : (
        <textarea
          className="mb-4 min-h-[420px] w-full rounded-lg border border-border bg-background p-3 font-mono text-xs"
          value={jsonText}
          onChange={(e) => onJsonChange(e.target.value)}
          spellCheck={false}
        />
      )}

      <Button type="button" onClick={onSave} disabled={saving || loading}>
        <Save className="h-4 w-4" />
        {saving ? 'Guardando…' : saveLabel}
      </Button>
    </AppShell>
  );
}
