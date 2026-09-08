import { Module } from '@nestjs/common';
import { PartnerBridgeModule } from '../partner-bridge/partner-bridge.module';
import { CoreController } from './core.controller';
import { CoreService } from './core.service';

@Module({
  imports: [PartnerBridgeModule],
  controllers: [CoreController],
  providers: [CoreService],
  exports: [CoreService],
})
export class CoreModule {}
