import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileJson, Save } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { validarJsonObjeto } from '@/lib/validar-json';
import { BandaPagina } from '@/components/ayudas/BandaPagina';
import { useAvisoSinGuardar, useCambiosSinGuardar } from '@/components/ui/aviso-sin-guardar';

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
  /** Motivo del cambio (opcional): queda en el historial del configurador. Si no se pasa, no se muestra. */
  motivo?: string;
  onMotivoChange?: (value: string) => void;
  /** Contenido bajo el botón de guardar (p. ej. el historial). */
  children?: React.ReactNode;
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
  motivo,
  onMotivoChange,
  children,
}: Sis2000NestJsonFormProps) {
  // Aviso al salir con cambios sin guardar: la base es el JSON ya cargado (o la plantilla inicial).
  const cambios = useCambiosSinGuardar(jsonText, !loading);
  const { dialogo, permitirSalida } = useAvisoSinGuardar(cambios.sucio);
  const { marcarGuardado } = cambios;
  // Validación al salir del campo, con la misma comprobación que al guardar.
  const [errorJson, setErrorJson] = useState<string | null>(null);
  useEffect(() => {
    if (success) marcarGuardado();
  }, [success, marcarGuardado]);

  return (
    <AppShell title={title}>
      {dialogo}
      <Link
        to={backHref}
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {backLabel}
      </Link>

      <BandaPagina className="mb-4">
        <h1 className="text-lg font-bold">{title}</h1>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
        <p className="text-xs text-amber-800 dark:text-amber-200">
          Mantenimiento de catálogo Sis2000 — no emite pólizas.
        </p>
      </BandaPagina>

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
          onChange={(e) => {
            onJsonChange(e.target.value);
            if (errorJson) setErrorJson(null);
          }}
          onBlur={() => setErrorJson(validarJsonObjeto(jsonText))}
          aria-invalid={errorJson ? true : undefined}
          spellCheck={false}
        />
      )}
      {errorJson && (
        <p role="alert" className="-mt-3 mb-4 text-xs font-semibold text-rose-600">
          {errorJson}
        </p>
      )}

      {onMotivoChange && (
        <div className="mb-3 max-w-xl">
          <label htmlFor="motivo-cambio" className="mb-1 block text-xs font-medium">
            Motivo del cambio (opcional, queda en el historial)
          </label>
          <input
            id="motivo-cambio"
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={motivo ?? ''}
            maxLength={500}
            onChange={(e) => onMotivoChange(e.target.value)}
          />
        </div>
      )}

      <Button type="button" onClick={() => void permitirSalida(onSave)} disabled={saving || loading}>
        <Save className="h-4 w-4" />
        {saving ? 'Guardando…' : saveLabel}
      </Button>

      {children}
    </AppShell>
  );
}
