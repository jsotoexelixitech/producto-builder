import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FormFieldType } from '@prisma/client';

export class RatingVariableDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/)
  name!: string;

  @IsString()
  @MinLength(2)
  label!: string;

  @IsEnum(FormFieldType)
  variableType!: FormFieldType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];
}

export class UpsertActuarialDto {
  @IsNumber()
  @Min(0.01)
  purePremium!: number;

  @IsNumber()
  @Min(0)
  @Max(99.99)
  administrativeExpenses!: number;

  @IsNumber()
  @Min(0)
  @Max(99.99)
  commissions!: number;

  @IsNumber()
  @Min(0)
  @Max(99.99)
  profitMargin!: number;

  @IsString()
  @MinLength(3)
  actuaryName!: string;

  @IsString()
  @MinLength(5)
  actuaryCedula!: string;

  @IsString()
  @Matches(/^[A-Z0-9-]+$/)
  actuarySudeasegNumber!: string;

  @IsOptional()
  @IsUrl()
  technicalNoteUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RatingVariableDto)
  ratingVariables?: RatingVariableDto[];
}
