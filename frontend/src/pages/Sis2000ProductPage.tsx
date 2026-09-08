import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import { api } from '@/lib/api';
import { EMPTY_SIS2000_PRODUCT, type Sis2000ProductInput } from '@/lib/sis2000-catalog';
import { Sis2000ProductForm } from '@/components/sis2000/Sis2000ProductForm';
import { Sis2000ProductPlansPanel } from '@/components/sis2000/Sis2000ProductPlansPanel';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

export function Sis2000ProductPage() {
  const { cproducto: routeCode } = useParams<{ cproducto: string }>();
  const navigate = useNavigate();
  const isNew = routeCode === 'new' || !routeCode;
  const code = isNew ? '' : decodeURIComponent(routeCode ?? '');

  const [form, setForm] = useState<Sis2000ProductInput>(EMPTY_SIS2000_PRODUCT);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    setError(null);
    api
      .getSis2000Product(code)
      .then((p) => setForm({ ...EMPTY_SIS2000_PRODUCT, ...p }))
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar producto'))
      .finally(() => setLoading(false));
  }, [code, isNew]);

  function patch<K extends keyof Sis2000ProductInput>(
    key: K,
    value: Sis2000ProductInput[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: Sis2000ProductInput = {
        ...form,
        cproducto: form.cproducto.trim().toUpperCase(),
        xabreviatura: form.xabreviatura.trim().toUpperCase(),
      };
      const res = isNew
        ? await api.createSis2000Product(payload)
        : await api.updateSis2000Product(code, payload);
      setForm({ ...EMPTY_SIS2000_PRODUCT, ...res.product });
      setSuccess(
        res.action === 'created'
          ? `Producto ${res.product.cproducto} creado en Sis2000.`
          : `Producto ${res.product.cproducto} actualizado.`,
      );
      if (isNew) {
        navigate(`/sis2000/${encodeURIComponent(res.product.cproducto)}`, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      backTo={{ href: '/sis2000', label: 'Sis2000 QA' }}
      title={isNew ? 'Nuevo producto Sis2000' : `Editar ${code}`}
      subtitle="Todos los campos de maproductos (list/detail partner)"
      actions={
        <Button type="submit" form="sis2000-form" disabled={saving || loading}>
          <Save className="h-4 w-4" />
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      }
    >
      <form id="sis2000-form" onSubmit={handleSave} className="animate-slide-up space-y-6">
        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        {loading ? (
          <div className="h-64 animate-pulse rounded-2xl bg-muted/60" />
        ) : (
          <Sis2000ProductForm form={form} isNew={isNew} onPatch={patch} />
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/sis2000">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={saving || loading}>
            {saving ? 'Guardando…' : 'Guardar en Sis2000'}
          </Button>
        </div>
      </form>

      {!isNew && !loading && (
        <Sis2000ProductPlansPanel cproducto={code} />
      )}
    </AppShell>
  );
}
