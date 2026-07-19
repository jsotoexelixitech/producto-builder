import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ContractCurrency,
  EmissionType,
  ProductBranch,
  ProductStatus,
  RenewalFrequency,
  RenewalType,
} from '@prisma/client';

export class PlanFieldsDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  subPlanCode?: string;

  @IsOptional()
  @IsString()
  vigenciaInicio?: string;

  @IsOptional()
  @IsString()
  vigenciaFin?: string;

  @IsOptional()
  @IsBoolean()
  allowsQuickEmission?: boolean;

  @IsOptional()
  @IsEnum(RenewalFrequency)
  renewalFrequency?: RenewalFrequency;

  @IsOptional()
  @IsEnum(RenewalType)
  renewalType?: RenewalType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  premiumGuaranteeDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  annualClosingMonth?: number;
}

export class CreateProductDto extends PlanFieldsDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  commercialName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[A-Z0-9_-]+$/)
  internalCode!: string;

  @IsEnum(ProductBranch)
  branch!: ProductBranch;

  @IsEnum(ContractCurrency)
  currency!: ContractCurrency;

  @IsEnum(EmissionType)
  emissionType!: EmissionType;
}

export class UpdateProductDto extends PlanFieldsDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  commercialName?: string;

  @IsOptional()
  @IsEnum(ContractCurrency)
  currency?: ContractCurrency;

  @IsOptional()
  @IsEnum(EmissionType)
  emissionType?: EmissionType;
}

export class TransitionStatusDto {
  @IsEnum(ProductStatus)
  toStatus!: ProductStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class ApproveProductDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9/-]+$/)
  numeroProvidenciaSudeaseg!: string;

  @IsString()
  @IsNotEmpty()
  fechaGacetaAprobacion!: string;
}
