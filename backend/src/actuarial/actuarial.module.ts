import { Module } from '@nestjs/common';
import { ActuarialController } from './actuarial.controller';
import { ActuarialService } from './actuarial.service';
import { ProductMutableGuard } from '../common/guards/product-mutable.guard';

@Module({
  controllers: [ActuarialController],
  providers: [ActuarialService, ProductMutableGuard],
})
export class ActuarialModule {}
