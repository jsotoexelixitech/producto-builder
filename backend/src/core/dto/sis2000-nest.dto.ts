import { IsInt, IsOptional, IsString, Min } from 'class-validator';
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

export class Sis2000PlanFrecuenciasDto {
  @IsString()
  cplan!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  cramo?: number;
}
