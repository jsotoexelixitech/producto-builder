import { Module } from '@nestjs/common';
import { EmissionBridgeController } from './emission-bridge.controller';
import { EmissionBridgeService } from './emission-bridge.service';

@Module({
  controllers: [EmissionBridgeController],
  providers: [EmissionBridgeService],
})
export class EmissionBridgeModule {}
