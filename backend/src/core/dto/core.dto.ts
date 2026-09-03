import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ProductBranch } from '@prisma/client';

export class ListSubBranchesQueryDto {
  @IsEnum(ProductBranch)
  branch!: ProductBranch;
}

export class ListCoreCoveragesQueryDto {
  @IsEnum(ProductBranch)
  branch!: ProductBranch;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  subBranchCode?: string;
}

export class CreateCoreCoverageDto {
  @IsEnum(ProductBranch)
  branch!: ProductBranch;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  subBranchCode?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[A-Z0-9_-]+$/)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  accountingCode?: string;
}

export class ImportCoreProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  coreCode!: string;
}

export class SyncProductToCoreDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
