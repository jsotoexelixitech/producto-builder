import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { defaultTarifaPayload } from '@/lib/sis2000-nest-api';
import { Sis2000NestJsonForm } from '@/components/sis2000/Sis2000NestJsonForm';

export function Sis2000TarifaFormPage() {
  const { cramo: cramoParam, ccobertura = '', ctarifa: routeTarifa } = useParams<{
    cramo: string;
    ccobertura: string;
    ctarifa?: string;
  }>();
  const cramo = Number(cramoParam ?? '18');
  const isEdit = Boolean(routeTarifa);
  const ctarifa = decodeURIComponent(routeTarifa ?? '');
  const navigate = useNavigate();

  const [jsonText, setJsonText] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [loadingDef, setLoadingDef] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [definicionHint, setDefinicionHint] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit) {
      setJsonText(JSON.stringify(defaultTarifaPayload(cramo, ccobertura), null, 2));
      return;
    }
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const rows = await api.listSis2000Tarifas(cramo, ccobertura);
        const row = rows.find((r) => String(r.ctarifa ?? '') === ctarifa);
        if (!row) throw new Error(`Tarifa ${ctarifa} no encontrada`);
        setJsonText(JSON.stringify({ ...row, operation: 'U' }, null, 2));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar tarifa');
      } finally {
        setLoading(false);
      }
    })();
  }, [cramo, ccobertura, ctarifa, isEdit]);

  async function loadDefinicion() {
    setLoadingDef(true);
    setError(null);
    try {
      const def = await api.getSis2000TarifasDefinicion();
      setDefinicionHint(JSON.stringify(def, null, 2).slice(0, 1200));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar definición');
    } finally {
      setLoadingDef(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = JSON.parse(jsonText) as Record<string, unknown>;
      if (isEdit) {
        payload.operation = 'U';
        await api.updateSis2000Tarifa(cramo, ccobertura, ctarifa, payload);
        setSuccess(`Tarifa ${ctarifa} actualizada`);
      } else {
        payload.operation = 'I';
        payload.ccobertura = payload.ccobertura ?? ccobertura;
        payload.cramo = payload.cramo ?? cramo;
        await api.createSis2000Tarifa(payload);
        setSuccess('Tarifa creada en Sis2000');
        navigate(
          `/sis2000/ramo/${cramo}/coberturas/${encodeURIComponent(ccobertura)}/tarifas`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar tarifa');
    } finally {
      setSaving(false);
    }
  }

  const backHref = `/sis2000/ramo/${cramo}/coberturas/${encodeURIComponent(ccobertura)}/tarifas`;

  return (
    <Sis2000NestJsonForm
      title={isEdit ? `Editar tarifa ${ctarifa}` : 'Nueva tarifa'}
      subtitle={`POST/PUT nest-api /api/v1/tarifas → matarifa · ${ccobertura}`}
      backHref={backHref}
      backLabel={`Tarifas ${ccobertura}`}
      jsonText={jsonText}
      onJsonChange={setJsonText}
      onSave={save}
      saving={saving}
      loading={loading}
      error={error}
      success={success}
      saveLabel={isEdit ? 'Actualizar tarifa' : 'Crear tarifa'}
      onLoadDefinicion={() => void loadDefinicion()}
      loadingDefinicion={loadingDef}
      definicionHint={definicionHint ?? undefined}
    />
  );
}
