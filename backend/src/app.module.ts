import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { CoveragesModule } from './coverages/coverages.module';
import { ActuarialModule } from './actuarial/actuarial.module';
import { LegalModule } from './legal/legal.module';
import { WorkflowModule } from './workflow/workflow.module';
import { SisipModule } from './sisip/sisip.module';
import { EmissionConfigModule } from './emission-config/emission-config.module';
import { ProductPlansModule } from './product-plans/product-plans.module';

@Module({
  imports: [
    PrismaModule,
    ProductsModule,
    CoveragesModule,
    ActuarialModule,
    LegalModule,
    WorkflowModule,
    SisipModule,
    EmissionConfigModule,
    ProductPlansModule,
  ],
})
export class AppModule {}
