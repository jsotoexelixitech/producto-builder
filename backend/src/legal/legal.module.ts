import { Module } from '@nestjs/common';
import { LegalController } from './legal.controller';
import { LegalService } from './legal.service';
import { ProductMutableGuard } from '../common/guards/product-mutable.guard';

@Module({
  controllers: [LegalController],
  providers: [LegalService, ProductMutableGuard],
})
export class LegalModule {}
