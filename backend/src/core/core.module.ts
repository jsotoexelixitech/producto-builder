import { Module } from '@nestjs/common';
import { PartnerBridgeModule } from '../partner-bridge/partner-bridge.module';
import { CoberturaSumaController } from './cobertura-suma.controller';
import { CoberturaSumaService } from './cobertura-suma.service';
import { CoreController } from './core.controller';
import { CoreService } from './core.service';
import { Sis2000NestController } from './sis2000-nest.controller';

@Module({
  imports: [PartnerBridgeModule],
  controllers: [CoreController, Sis2000NestController, CoberturaSumaController],
  providers: [CoreService, CoberturaSumaService],
  exports: [CoreService],
})
export class CoreModule {}
