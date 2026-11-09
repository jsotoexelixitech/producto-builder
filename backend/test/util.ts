// Reexporta los mappers reales para que el Sis2000 simulado guarde lo mismo que recibiría nest-api.
import { cuerpoPlan } from '../src/partner-bridge/partner-bridge.service';

export { aEditarCobertura, aEditarProveedorPlan, aProveedorPlan } from '../src/partner-bridge/configurador.mapper';

export const cuerpoPlanParaPrueba = (body: Record<string, unknown>) => cuerpoPlan(body) as Record<string, unknown>;
