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
import { Sis2000Fase2Controller } from './sis2000-fase2.controller';
import { ConfiguradorFase2Service } from './configurador-fase2.service';

@Module({
  imports: [PartnerBridgeModule],
  // Sis2000Fase2Controller antes que Sis2000NestController: ramos/resumen no debe caer en ramos/:cramo.
  controllers: [CoreController, Sis2000Fase2Controller, Sis2000NestController, CoberturaSumaController, HistorialController],
  providers: [
    CoreService,
    CoberturaSumaService,
    Sis2000RespaldoService,
    Sis2000HistorialService,
    ConfiguradorFase2Service,
    { provide: RESPALDO_REPO, useClass: PrismaRespaldoRepo },
  ],
  exports: [CoreService],
})
export class CoreModule {}
