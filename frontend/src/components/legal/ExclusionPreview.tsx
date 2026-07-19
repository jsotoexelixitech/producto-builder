import { Document, Page, StyleSheet, Text } from '@react-pdf/renderer';
import { FileWarning, Scale } from 'lucide-react';
import type { Exclusion } from '@/types/product';

const pdfStyles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: 'Helvetica' },
  title: { fontSize: 14, marginBottom: 12, fontWeight: 'bold' },
  section: { marginBottom: 8 },
  legalHighlight: {
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#B91C1C',
    marginBottom: 6,
    lineHeight: 1.4,
  },
  note: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 16,
    borderTop: '1pt solid #E2E8F0',
    paddingTop: 8,
  },
});

export function PolicyPdfDocument({
  productName,
  exclusions,
}: {
  productName: string;
  exclusions: Exclusion[];
}) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <Text style={pdfStyles.title}>PÓLIZA — {productName}</Text>
        <Text style={pdfStyles.section}>
          Exclusiones contractuales y causales de caducidad (Reglamento Art. 68):
        </Text>
        {exclusions.map((ex, i) => (
          <Text key={i} style={pdfStyles.legalHighlight}>
            {ex.text}
          </Text>
        ))}
        <Text style={pdfStyles.note}>
          Vista previa: el motor PDF aplica negrilla, mayúsculas y color de resalte
          obligatorio sobre exclusiones marcadas con typographyHighlight.
        </Text>
      </Page>
    </Document>
  );
}

export function ExclusionHtmlPreview({ exclusions }: { exclusions: Exclusion[] }) {
  return (
    <div className="overflow-hidden rounded-xl border-2 border-slate-200 bg-gradient-to-b from-slate-50 to-white shadow-inner">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100/80 px-4 py-3">
        <Scale className="h-4 w-4 text-slate-600" />
        <div>
          <p className="text-sm font-semibold text-slate-800">
            Vista previa — Póliza / Cuadro Recibo
          </p>
          <p className="text-xs text-slate-500">Reglamento Art. 68 SUDEASEG</p>
        </div>
      </div>
      <div className="p-5 font-serif text-sm leading-relaxed">
        <p className="mb-4 text-xs font-sans uppercase tracking-wider text-slate-500">
          Exclusiones contractuales y causales de caducidad
        </p>
        {exclusions.length === 0 ? (
          <p className="font-sans text-muted-foreground">Sin exclusiones registradas.</p>
        ) : (
          <ul className="space-y-3">
            {exclusions.map((ex, i) => (
              <li
                key={i}
                className={
                  ex.typographyHighlight
                    ? 'rounded-lg border border-red-200 bg-red-50/50 px-4 py-3 font-bold uppercase tracking-wide text-red-800'
                    : 'rounded-lg border border-dashed border-red-300 px-4 py-3 text-slate-500 line-through'
                }
              >
                {ex.text || '(Texto vacío)'}
                {!ex.typographyHighlight && (
                  <span className="mt-1 block font-sans text-xs font-normal normal-case text-red-600">
                    Violación: resalte tipográfico desactivado
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-slate-200 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-900">
        <FileWarning className="h-3.5 w-3.5 shrink-0" />
        El motor PDF aplicará negrilla, mayúsculas y color de resalte obligatorio.
      </div>
    </div>
  );
}
