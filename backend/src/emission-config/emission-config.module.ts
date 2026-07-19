import { Module } from '@nestjs/common';
import { EmissionConfigController } from './emission-config.controller';
import { EmissionConfigService } from './emission-config.service';

@Module({
  controllers: [EmissionConfigController],
  providers: [EmissionConfigService],
  exports: [EmissionConfigService],
})
export class EmissionConfigModule {}
