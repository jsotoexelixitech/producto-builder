import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FormFieldType } from '@prisma/client';

export class FlowStepConfigDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  stepKey!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  shortLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  formEnabled?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class EmissionFormFieldDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  label!: string;

  @IsEnum(FormFieldType)
  fieldType!: FormFieldType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  stepKey?: string;
}

export class UpsertEmissionConfigDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlowStepConfigDto)
  flowSteps!: FlowStepConfigDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmissionFormFieldDto)
  formFields!: EmissionFormFieldDto[];
}
