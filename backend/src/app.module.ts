import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard, RolesGuard } from './common/guards/jwt-auth.guard';
import { HealthModule } from './health/health.module';
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
    AuthModule,
    HealthModule,
    ProductsModule,
    CoveragesModule,
    ActuarialModule,
    LegalModule,
    WorkflowModule,
    SisipModule,
    EmissionConfigModule,
    ProductPlansModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
