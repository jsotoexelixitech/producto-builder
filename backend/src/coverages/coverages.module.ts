import { Module } from '@nestjs/common';
import { CoveragesController } from './coverages.controller';
import { CoveragesService } from './coverages.service';
import { ProductMutableGuard } from '../common/guards/product-mutable.guard';

@Module({
  controllers: [CoveragesController],
  providers: [CoveragesService, ProductMutableGuard],
})
export class CoveragesModule {}
