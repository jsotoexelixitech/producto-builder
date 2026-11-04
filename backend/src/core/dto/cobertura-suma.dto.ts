import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { TipoSumaAsegurada } from '@prisma/client';

export class CoberturaSumaRamoParamDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cramo!: number;
}

export class CoberturaSumaParamDto extends CoberturaSumaRamoParamDto {
  @IsString()
  @Matches(/^[A-Za-z0-9]{1,4}$/)
  ccobertura!: string;
}

/** Cómo se obtiene la suma asegurada de la cobertura: FIJA (hoy) o CALCULADA al emitir (unidades × valor por unidad). */
export class UpsertCoberturaSumaDto {
  @IsEnum(TipoSumaAsegurada)
  tipoSuma!: TipoSumaAsegurada;

  /** Nombre genérico de la unidad en el sistema. Opcional. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  unidadCalculo?: string;

  /** Palabra que sale en el cuadro póliza. Obligatoria si tipoSuma = CALCULADA. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  etiquetaCuadro?: string;
}
