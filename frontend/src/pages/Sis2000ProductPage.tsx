import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import { api } from '@/lib/api';
import {
  EMPTY_SIS2000_PRODUCT,
  SIS2000_XFORM_OPTIONS,
  type Sis2000ProductInput,
} from '@/lib/sis2000-catalog';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { FormField, FormGrid } from '@/components/ui/form-field';
import { SectionPanel } from '@/components/ui/section-panel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleField } from '@/components/ui/toggle-field';

export function Sis2000ProductPage() {
  const { cproducto: routeCode } = useParams<{ cproducto: string }>();
  const navigate = useNavigate();
  const isNew = routeCode === 'new' || !routeCode;
  const code = isNew ? '' : decodeURIComponent(routeCode ?? '');

  const [form, setForm] = useState<Sis2000ProductInput>(EMPTY_SIS2000_PRODUCT);
  const [meta, setMeta] = useState<{ ifuente?: string; cprog?: string; fingreso?: string }>({});
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
      .then((p) => {
        setForm({
          cproducto: p.cproducto,
          xdescripcion_l: p.xdescripcion_l,
          xabreviatura: p.xabreviatura,
          xform: p.xform,
          iproductor: p.iproductor,
          icanal: p.icanal,
          cramo: p.cramo,
          ctiporamo: p.ctiporamo,
          xdescripcion_prod: p.xdescripcion_prod ?? '',
          mmonto_inicial: p.mmonto_inicial ?? '',
          xfraccionamiento: p.xfraccionamiento ?? '',
          xurl_presentacion: p.xurl_presentacion ?? '',
          norden: p.norden,
          xdescripcion_c: p.xdescripcion_c ?? '',
        });
        setMeta({
          ifuente: p.ifuente,
          cprog: p.cprog,
          fingreso: p.fingreso,
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar producto'))
      .finally(() => setLoading(false));
  }, [code, isNew]);

  function patch<K extends keyof Sis2000ProductInput>(key: K, value: Sis2000ProductInput[K]) {
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
        norden: form.norden != null && !Number.isNaN(form.norden) ? form.norden : undefined,
      };
      const res = isNew
        ? await api.createSis2000Product(payload)
        : await api.updateSis2000Product(code, payload);
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
      subtitle="Campos maproductos vía nest-api partner"
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

        {!isNew && meta.ifuente && (
          <div className="rounded-xl border border-border/60 bg-muted/15 px-4 py-3 text-xs text-muted-foreground">
            Fuente: <strong>{meta.ifuente}</strong>
            {meta.cprog ? ` · ${meta.cprog}` : ''}
            {meta.fingreso ? ` · ${new Date(meta.fingreso).toLocaleString('es-VE')}` : ''}
          </div>
        )}

        {loading ? (
          <div className="h-64 animate-pulse rounded-2xl bg-muted/60" />
        ) : (
          <>
            <SectionPanel title="Identificación" description="Código y textos comerciales en Sis2000.">
              <FormGrid>
                <FormField label="cproducto" hint="Máx. 6 caracteres alfanuméricos.">
                  <Input
                    value={form.cproducto}
                    disabled={!isNew}
                    maxLength={6}
                    onChange={(e) => patch('cproducto', e.target.value.toUpperCase())}
                    placeholder="Ej. TSTPB1"
                  />
                </FormField>
                <FormField label="xabreviatura" hint="Máx. 5 caracteres.">
                  <Input
                    value={form.xabreviatura}
                    maxLength={5}
                    onChange={(e) => patch('xabreviatura', e.target.value.toUpperCase())}
                  />
                </FormField>
                <FormField label="xdescripcion_l" className="sm:col-span-2">
                  <Input
                    value={form.xdescripcion_l}
                    maxLength={120}
                    onChange={(e) => patch('xdescripcion_l', e.target.value)}
                  />
                </FormField>
                <FormField label="xdescripcion_prod" className="sm:col-span-2">
                  <Input
                    value={form.xdescripcion_prod ?? ''}
                    onChange={(e) => patch('xdescripcion_prod', e.target.value)}
                  />
                </FormField>
              </FormGrid>
            </SectionPanel>

            <SectionPanel title="Clasificación" description="Ramo, tipo y formulario de emisión.">
              <FormGrid>
                <FormField label="xform">
                  <Select value={form.xform} onValueChange={(v) => patch('xform', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SIS2000_XFORM_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="norden">
                  <Input
                    type="number"
                    value={form.norden ?? ''}
                    onChange={(e) =>
                      patch('norden', e.target.value ? Number(e.target.value) : undefined)
                    }
                  />
                </FormField>
                <FormField label="cramo">
                  <Input
                    type="number"
                    value={form.cramo}
                    onChange={(e) => patch('cramo', Number(e.target.value))}
                  />
                </FormField>
                <FormField label="ctiporamo">
                  <Input
                    type="number"
                    value={form.ctiporamo}
                    onChange={(e) => patch('ctiporamo', Number(e.target.value))}
                  />
                </FormField>
                <ToggleField
                  id="iproductor"
                  label="iproductor (visible corredor)"
                  checked={form.iproductor}
                  onChange={(v) => patch('iproductor', v)}
                />
                <ToggleField
                  id="icanal"
                  label="icanal (visible canal)"
                  checked={form.icanal}
                  onChange={(v) => patch('icanal', v)}
                />
              </FormGrid>
            </SectionPanel>

            <SectionPanel title="Presentación comercial">
              <FormGrid>
                <FormField label="mmonto_inicial">
                  <Input
                    value={form.mmonto_inicial ?? ''}
                    placeholder="12,50$"
                    onChange={(e) => patch('mmonto_inicial', e.target.value)}
                  />
                </FormField>
                <FormField label="xfraccionamiento">
                  <Input
                    value={form.xfraccionamiento ?? ''}
                    onChange={(e) => patch('xfraccionamiento', e.target.value)}
                  />
                </FormField>
                <FormField label="xurl_presentacion" className="sm:col-span-2">
                  <Input
                    value={form.xurl_presentacion ?? ''}
                    onChange={(e) => patch('xurl_presentacion', e.target.value)}
                  />
                </FormField>
                <FormField label="xdescripcion_c (icono)" className="sm:col-span-2">
                  <Input
                    value={form.xdescripcion_c ?? ''}
                    placeholder="salud.png"
                    onChange={(e) => patch('xdescripcion_c', e.target.value)}
                  />
                </FormField>
              </FormGrid>
            </SectionPanel>
          </>
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
    </AppShell>
  );
}
