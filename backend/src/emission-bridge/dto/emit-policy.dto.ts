import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class PartyBridgeDto {
  @IsString()
  nombre!: string;

  @IsString()
  identificacion!: string;

  @IsOptional()
  @IsString()
  parentesco?: string;

  @IsOptional()
  @IsString()
  ciudad?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  telefono?: string;
}

export class EmitPolicyBridgeDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsString()
  planName?: string;

  @ValidateNested()
  @Type(() => PartyBridgeDto)
  tomador!: PartyBridgeDto;

  @ValidateNested()
  @Type(() => PartyBridgeDto)
  asegurado!: PartyBridgeDto;

  @IsOptional()
  @IsObject()
  riskData?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  policyTemplate?: string;

  @IsOptional()
  @IsString()
  estatus?: string;

  /** Default true: emisión garantizada sin pasarela real. */
  @IsOptional()
  @IsBoolean()
  simulatePayment?: boolean;
}

export class QuoteBridgeDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsString()
  planName?: string;
}
