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
import { DocumentType, FormFieldType } from '@prisma/client';

export class ExclusionDto {
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  text!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  typographyHighlight?: boolean;
}

export class LegalDocumentDto {
  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @MinLength(10)
  content!: string;

  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;

  @IsOptional()
  @IsBoolean()
  isSimplifiedTemplate?: boolean;
}

export class CommercialChannelDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  channelType!: string;
}

export class FormFieldDto {
  @IsString()
  @MinLength(2)
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
}

export class RequiredDocumentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  documentKey!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpsertLegalBundleDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExclusionDto)
  exclusions!: ExclusionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LegalDocumentDto)
  documents!: LegalDocumentDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommercialChannelDto)
  commercialChannels?: CommercialChannelDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  formFields?: FormFieldDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequiredDocumentDto)
  requiredDocuments?: RequiredDocumentDto[];
}
