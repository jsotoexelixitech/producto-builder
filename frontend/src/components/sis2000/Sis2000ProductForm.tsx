import {
  SIS2000_FIELD_DEFS,
  SIS2000_SECTION_LABELS,
  SIS2000_XFORM_OPTIONS,
  type Sis2000FieldDef,
  type Sis2000ProductInput,
} from '@/lib/sis2000-catalog';
import { FormField, FormGrid } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleField } from '@/components/ui/toggle-field';
import { SectionPanel } from '@/components/ui/section-panel';

interface Sis2000ProductFormProps {
  form: Sis2000ProductInput;
  isNew: boolean;
  onPatch: <K extends keyof Sis2000ProductInput>(
    key: K,
    value: Sis2000ProductInput[K],
  ) => void;
}

function displayInputValue(
  form: Sis2000ProductInput,
  key: keyof Sis2000ProductInput,
): string {
  const value = form[key];
  if (value == null || typeof value === 'boolean') return '';
  return String(value);
}

function renderField(
  def: Sis2000FieldDef,
  form: Sis2000ProductInput,
  isNew: boolean,
  onPatch: Sis2000ProductFormProps['onPatch'],
) {
  if (def.createOnly && !isNew) {
    return (
      <FormField key={def.key} label={def.label} hint={def.hint}>
        <Input value={String(form[def.key] ?? '')} disabled readOnly />
      </FormField>
    );
  }

  const wideClass = def.wide ? 'sm:col-span-2' : undefined;

  if (def.type === 'boolean') {
    return (
      <ToggleField
        key={def.key}
        id={def.key}
        label={def.label}
        description={def.hint}
        checked={Boolean(form[def.key])}
        onChange={(v) => onPatch(def.key, v as Sis2000ProductInput[typeof def.key])}
        className={wideClass}
      />
    );
  }

  if (def.type === 'tri-bool') {
    const current =
      form[def.key] === null || form[def.key] === undefined
        ? 'null'
        : form[def.key]
          ? 'true'
          : 'false';
    return (
      <FormField key={def.key} label={def.label} hint={def.hint} className={wideClass}>
        <Select
          value={current}
          onValueChange={(v) =>
            onPatch(
              def.key,
              v === 'null' ? null : v === 'true',
            )
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="null">null</SelectItem>
            <SelectItem value="true">true</SelectItem>
            <SelectItem value="false">false</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
    );
  }

  if (def.type === 'select' && def.key === 'xform') {
    return (
      <FormField key={def.key} label={def.label} className={wideClass}>
        <Select
          value={form.xform}
          onValueChange={(v) => onPatch('xform', v)}
        >
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
    );
  }

  if (def.type === 'number') {
    return (
      <FormField key={def.key} label={def.label} hint={def.hint} className={wideClass}>
        <Input
          type="number"
          value={displayInputValue(form, def.key)}
          onChange={(e) =>
            onPatch(
              def.key,
              e.target.value === '' ? null : Number(e.target.value),
            )
          }
        />
      </FormField>
    );
  }

  return (
    <FormField key={def.key} label={def.label} hint={def.hint} className={wideClass}>
      <Input
        value={displayInputValue(form, def.key)}
        onChange={(e) => {
          const val = e.target.value;
          const requiredText = def.key === 'cproducto' || def.key === 'xdescripcion_l' || def.key === 'xabreviatura';
          onPatch(def.key, (requiredText ? val : val === '' ? null : val) as Sis2000ProductInput[typeof def.key]);
        }}
      />
    </FormField>
  );
}

export function Sis2000ProductForm({ form, isNew, onPatch }: Sis2000ProductFormProps) {
  const sections: Sis2000FieldDef['section'][] = [
    'identificacion',
    'clasificacion',
    'comercial',
    'auditoria',
  ];

  return (
    <>
      {sections.map((section) => (
        <SectionPanel
          key={section}
          title={SIS2000_SECTION_LABELS[section]}
          description={
            section === 'auditoria'
              ? 'Campos devueltos por list/detail partner — editables en QA.'
              : undefined
          }
        >
          <FormGrid>
            {SIS2000_FIELD_DEFS.filter((def) => def.section === section).map((def) =>
              renderField(def, form, isNew, onPatch),
            )}
          </FormGrid>
        </SectionPanel>
      ))}
    </>
  );
}
