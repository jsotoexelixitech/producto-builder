import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { DeductibleType } from '@prisma/client';

export class CreateCoverageDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isBasicMandatory?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  insuredSumMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  insuredSumMax?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  insuredSumFixed?: number;

  @IsOptional()
  @IsEnum(DeductibleType)
  deductibleType?: DeductibleType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deductibleValue?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  waitingPeriodDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tariffPremium?: number;

  @IsOptional()
  @IsString()
  vigenciaDesde?: string;

  @IsOptional()
  @IsString()
  vigenciaHasta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  dependsOnCoverageName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  coberturaInternaCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  tarifaInternaCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  treatmentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  calculationService?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  reinsuranceContractCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  reinsuranceContractName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  reinsuranceBranchCode?: string;
}

export class UpdateCoverageDto extends CreateCoverageDto {}

export class ReplaceCoveragesDto {
  coverages!: CreateCoverageDto[];
}
