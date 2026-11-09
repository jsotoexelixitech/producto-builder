import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ENTIDADES_RESPALDO, type EntidadRespaldo } from '../respaldo/respaldo.types';

export class HistorialParamDto {
  @IsIn(ENTIDADES_RESPALDO)
  entidad!: EntidadRespaldo;

  /** "28-12" (cobertura), "28-12-1" (tarifa), "28-PBT1" (plan o proveedores del plan) o cproducto. */
  @IsString()
  @Matches(/^[A-Za-z0-9 _-]{1,40}$/)
  clave!: string;
}

/** Original o una versión; «antes» = cómo estaba antes de esa versión, «despues» = cómo quedó. */
export class DestinoRestauracionDto {
  @IsString()
  @Matches(/^(ORIGINAL|[0-9a-fA-F-]{36})$/, { message: 'destino debe ser ORIGINAL o el id de una versión.' })
  destino!: string;

  @IsOptional()
  @IsIn(['antes', 'despues'])
  momento?: 'antes' | 'despues';
}

export class RestaurarDto extends DestinoRestauracionDto {
  @IsString()
  @MinLength(5, { message: 'Indica el motivo de la restauración (mínimo 5 caracteres).' })
  @MaxLength(500)
  motivo!: string;
}
