import type { AuthUserPayload } from '../../auth/auth.service';
import type { ContextoCambio } from './respaldo.types';

/** Campo opcional del cuerpo con el motivo de un cambio; no se envía a nest-api. */
export const CAMPO_MOTIVO = 'motivoCambio';

/** Quién (usuario del token) y por qué (motivo opcional). */
export function contextoCambio(user?: AuthUserPayload, motivo?: unknown): ContextoCambio {
  const texto = typeof motivo === 'string' ? motivo.trim().slice(0, 500) : '';
  return {
    usuario: user ? { id: user.sub, email: user.email, nombre: user.fullName } : undefined,
    motivo: texto || undefined,
  };
}

/** Separa el motivo del cuerpo que va a nest-api. */
export function separarMotivo(body: Record<string, unknown>): {
  cuerpo: Record<string, unknown>;
  motivo: unknown;
} {
  const { [CAMPO_MOTIVO]: motivo, ...cuerpo } = body ?? {};
  return { cuerpo, motivo };
}
