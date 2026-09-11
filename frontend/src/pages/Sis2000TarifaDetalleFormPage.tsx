import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { defaultTarifaDetallePayload } from '@/lib/sis2000-nest-api';
import { Sis2000NestJsonForm } from '@/components/sis2000/Sis2000NestJsonForm';

export function Sis2000TarifaDetalleFormPage() {
  const { cramo: cramoParam, ccobertura = '', ctarifa = '' } = useParams<{
    cramo: string;
    ccobertura: string;
    ctarifa: string;
  }>();
  const cramo = Number(cramoParam ?? '18');
  const navigate = useNavigate();

  const [jsonText, setJsonText] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingDef, setLoadingDef] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [definicionHint, setDefinicionHint] = useState<string | null>(null);

  useEffect(() => {
    setJsonText(
      JSON.stringify(defaultTarifaDetallePayload(cramo, ccobertura, ctarifa), null, 2),
    );
  }, [cramo, ccobertura, ctarifa]);

  async function loadDefinicion() {
    setLoadingDef(true);
    setError(null);
    try {
      const def = await api.getSis2000TarifasDetalleDefinicion();
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
      payload.operation = 'I';
      payload.cramo = payload.cramo ?? cramo;
      payload.ccobertura = payload.ccobertura ?? ccobertura;
      payload.ctarifa = payload.ctarifa ?? ctarifa;
      await api.createSis2000TarifaDetalle(payload);
      setSuccess('Detalle de tarifa creado');
      navigate(
        `/sis2000/ramo/${cramo}/coberturas/${encodeURIComponent(ccobertura)}/tarifas/${encodeURIComponent(ctarifa)}/detalles`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar detalle');
    } finally {
      setSaving(false);
    }
  }

  const backHref = `/sis2000/ramo/${cramo}/coberturas/${encodeURIComponent(ccobertura)}/tarifas/${encodeURIComponent(ctarifa)}/detalles`;

  return (
    <Sis2000NestJsonForm
      title={`Nuevo detalle tarifa ${ctarifa}`}
      subtitle="POST nest-api /api/v1/tarifas/detalles/create → matarifa_d"
      backHref={backHref}
      backLabel="Historial detalle"
      jsonText={jsonText}
      onJsonChange={setJsonText}
      onSave={save}
      saving={saving}
      error={error}
      success={success}
      saveLabel="Crear detalle"
      onLoadDefinicion={() => void loadDefinicion()}
      loadingDefinicion={loadingDef}
      definicionHint={definicionHint ?? undefined}
    />
  );
}
