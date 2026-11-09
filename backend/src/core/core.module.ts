import { Module } from '@nestjs/common';
import { PartnerBridgeModule } from '../partner-bridge/partner-bridge.module';
import { CoberturaSumaController } from './cobertura-suma.controller';
import { CoberturaSumaService } from './cobertura-suma.service';
import { CoreController } from './core.controller';
import { CoreService } from './core.service';
import { HistorialController } from './historial.controller';
import { PrismaRespaldoRepo } from './respaldo/respaldo-prisma.repo';
import { RESPALDO_REPO } from './respaldo/respaldo.types';
import { Sis2000HistorialService } from './respaldo/sis2000-historial.service';
import { Sis2000RespaldoService } from './respaldo/sis2000-respaldo.service';
import { Sis2000NestController } from './sis2000-nest.controller';

@Module({
  imports: [PartnerBridgeModule],
  controllers: [CoreController, Sis2000NestController, CoberturaSumaController, HistorialController],
  providers: [
    CoreService,
    CoberturaSumaService,
    Sis2000RespaldoService,
    Sis2000HistorialService,
    { provide: RESPALDO_REPO, useClass: PrismaRespaldoRepo },
  ],
  exports: [CoreService],
})
export class CoreModule {}
