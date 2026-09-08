import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListSis2000PlansQueryDto {
  @IsOptional()
  @IsString()
  centidad?: string;

  @IsOptional()
  @IsString()
  citem?: string;
}

export class GetSis2000PlanDetailQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cramo!: number;

  @IsString()
  cplan!: string;
}
