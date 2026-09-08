import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class Sis2000ProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(6)
  @Matches(/^[A-Za-z0-9]+$/)
  cproducto!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  cramo?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  u_version?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  xdescripcion_l!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  xdescripcion_c?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(5)
  @Matches(/^[A-Za-z0-9]+$/)
  xabreviatura!: string;

  @IsBoolean()
  iproductor!: boolean;

  @IsBoolean()
  icanal!: boolean;

  @IsString()
  @MinLength(2)
  @MaxLength(40)
  xform!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  cprog?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  ifuente?: string;

  @IsOptional()
  @IsBoolean()
  bok?: boolean | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cerror?: string;

  @IsOptional()
  @IsString()
  fingreso?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  cusuario?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ccategoria?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  cusuarioauto?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ccategoriaauto?: number;

  @IsOptional()
  @IsString()
  fultmod?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  cusuariomod?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ccategoriamod?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ctiporamo?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  xdescripcion_prod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  mmonto_inicial?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  norden?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  xfraccionamiento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  xurl_presentacion?: string;
}
