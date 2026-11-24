import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class Sis2000RamoParamDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cramo!: number;
}

export class Sis2000CoberturaParamDto extends Sis2000RamoParamDto {
  @IsString()
  ccobertura!: string;
}

export class Sis2000TarifaParamDto extends Sis2000CoberturaParamDto {
  @IsString()
  ctarifa!: string;
}

export class Sis2000PlanCotizarDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cramo!: number;

  @IsString()
  cplan!: string;

  @IsOptional()
  @IsString()
  ifrecuencia?: string;

  /** Personas: parentesco a cotizar (spCalculoPer). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  cparen?: number;

  /** Personas: edad del asegurado. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  nedad?: number;

  /** Personas: suma asegurada (0 = la del plan). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  msumaaseg?: number;
}

export class Sis2000PlanFrecuenciasDto {
  @IsString()
  cplan!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  cramo?: number;
}
