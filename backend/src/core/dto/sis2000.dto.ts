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

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  xdescripcion_l!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(5)
  @Matches(/^[A-Za-z0-9]+$/)
  xabreviatura!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(40)
  xform!: string;

  @IsBoolean()
  iproductor!: boolean;

  @IsBoolean()
  icanal!: boolean;

  @IsInt()
  cramo!: number;

  @IsInt()
  ctiporamo!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  xdescripcion_prod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  mmonto_inicial?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  xfraccionamiento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  xurl_presentacion?: string;

  @IsOptional()
  @IsInt()
  norden?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  xdescripcion_c?: string;
}
