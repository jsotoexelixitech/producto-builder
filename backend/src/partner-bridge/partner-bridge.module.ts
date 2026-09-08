import { Module } from '@nestjs/common';
import { PartnerBridgeService } from './partner-bridge.service';

@Module({
  providers: [PartnerBridgeService],
  exports: [PartnerBridgeService],
})
export class PartnerBridgeModule {}
