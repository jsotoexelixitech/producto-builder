import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { defaultCoberturaPayload } from '@/lib/sis2000-nest-api';
import { Sis2000NestJsonForm } from '@/components/sis2000/Sis2000NestJsonForm';

export function Sis2000CoberturaFormPage() {
  const { cramo: cramoParam, ccobertura: routeCobertura } = useParams<{
    cramo: string;
    ccobertura?: string;
  }>();
  const cramo = Number(cramoParam ?? '18');
  const isEdit = Boolean(routeCobertura);
  const ccobertura = decodeURIComponent(routeCobertura ?? '');
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
      setJsonText(JSON.stringify(defaultCoberturaPayload(cramo), null, 2));
      return;
    }
    setLoading(true);
    setError(null);
    api
      .getSis2000Cobertura(cramo, ccobertura)
      .then((row) => {
        const payload = { ...row, operation: 'U' };
        setJsonText(JSON.stringify(payload, null, 2));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar cobertura'))
      .finally(() => setLoading(false));
  }, [cramo, ccobertura, isEdit]);

  async function loadDefinicion() {
    setLoadingDef(true);
    setError(null);
    try {
      const def = await api.getSis2000CoberturasDefinicion();
      setDefinicionHint(
        typeof def === 'string'
          ? def.slice(0, 800)
          : JSON.stringify(def, null, 2).slice(0, 1200),
      );
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
        await api.updateSis2000Cobertura(cramo, ccobertura, payload);
        setSuccess(`Cobertura ${ccobertura} actualizada`);
      } else {
        payload.operation = 'I';
        await api.createSis2000Cobertura(payload);
        setSuccess('Cobertura creada en Sis2000');
        navigate(`/sis2000/ramo/${cramo}/coberturas`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar cobertura');
    } finally {
      setSaving(false);
    }
  }

  const backHref = `/sis2000/ramo/${cramo}/coberturas`;

  return (
    <Sis2000NestJsonForm
      title={isEdit ? `Editar cobertura ${ccobertura}` : 'Nueva cobertura'}
      subtitle={`POST/PUT nest-api /api/v1/coberturas → macoberturas · ramo ${cramo}`}
      backHref={backHref}
      backLabel={`Coberturas ramo ${cramo}`}
      jsonText={jsonText}
      onJsonChange={setJsonText}
      onSave={save}
      saving={saving}
      loading={loading}
      error={error}
      success={success}
      saveLabel={isEdit ? 'Actualizar cobertura' : 'Crear cobertura'}
      onLoadDefinicion={() => void loadDefinicion()}
      loadingDefinicion={loadingDef}
      definicionHint={definicionHint ?? undefined}
    />
  );
}
