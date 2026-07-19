import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpsertSisipConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  ramoInternoCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  ramoInternoName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  branchAlias1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  branchAlias2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  producerCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  producerName?: string;

  @IsOptional()
  @IsBoolean()
  assignToAllProducers?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  counterCotizacion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  counterPoliza?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  counterRecibo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  counterSiniestro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  maskPoliza?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  maskRecibo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  maskSiniestro?: string;
}
