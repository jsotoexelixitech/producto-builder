import { Module } from '@nestjs/common';
import { PartnerBridgeModule } from '../partner-bridge/partner-bridge.module';
import { CoreController } from './core.controller';
import { CoreService } from './core.service';
import { Sis2000NestController } from './sis2000-nest.controller';

@Module({
  imports: [PartnerBridgeModule],
  controllers: [CoreController, Sis2000NestController],
  providers: [CoreService],
  exports: [CoreService],
})
export class CoreModule {}
