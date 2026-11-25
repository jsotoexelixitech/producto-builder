// Resumen en palabras de lo que se va a guardar, a partir del estado del formulario (sin llamadas al servidor).

export interface EntradaResumen {
  /** true = se edita un plan que ya existe. */
  modoEdicion: boolean;
  cplan: string;
  nombrePlan: string;
  producto: string;
  personas: boolean;
  coberturas: number;
  moneda: string;
  formasDePago: number;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function resumenEnPalabras(e: EntradaResumen): string {
  const codigo = e.cplan.trim();
  const nombre = e.nombrePlan.trim();
  const verbo = e.modoEdicion ? 'Se guardarán los cambios del plan' : 'Se creará el plan';
  const quien = codigo ? `${codigo}${nombre ? ` («${nombre}»)` : ''}` : nombre ? `«${nombre}»` : '(todavía sin código)';
  const partes = [`${verbo} ${quien}`];
  if (e.producto.trim()) partes.push(`en el producto ${e.producto.trim()}`);
  const cola = [
    e.coberturas > 0 ? `con ${plural(e.coberturas, 'cobertura', 'coberturas')}` : 'sin coberturas marcadas',
    e.formasDePago > 0 ? plural(e.formasDePago, 'forma de pago', 'formas de pago') : '',
    e.moneda.trim() ? `moneda ${e.moneda.trim()}` : '',
    e.personas ? 'tipo personas' : '',
  ].filter(Boolean);
  return `${partes.join(' ')}, ${cola.join(', ')}.`;
}
