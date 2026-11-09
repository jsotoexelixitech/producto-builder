import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUserPayload } from '../auth/auth.service';
import { DestinoRestauracionDto, HistorialParamDto, RestaurarDto } from './dto/historial.dto';
import { Sis2000HistorialService } from './respaldo/sis2000-historial.service';
import { contextoCambio } from './respaldo/contexto';

/**
 * Historial de lo que el configurador escribió en Sis2000 (copia original + versiones) y restauración.
 * Los datos viven en la Postgres del configurador; restaurar reescribe Sis2000 por nest-api y queda como versión.
 */
@Controller('core/sis2000/historial')
export class HistorialController {
  constructor(private readonly historial: Sis2000HistorialService) {}

  @Get(':entidad/:clave')
  listar(@Param() p: HistorialParamDto) {
    return this.historial.historial(p.entidad, p.clave);
  }

  @Get(':entidad/:clave/vista-previa')
  vistaPrevia(@Param() p: HistorialParamDto, @Query() q: DestinoRestauracionDto) {
    return this.historial.vistaPrevia(p.entidad, p.clave, q.destino, q.momento);
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Post(':entidad/:clave/restaurar')
  restaurar(
    @Param() p: HistorialParamDto,
    @Body() dto: RestaurarDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.historial.restaurar(
      p.entidad,
      p.clave,
      { destino: dto.destino, momento: dto.momento, motivo: dto.motivo },
      contextoCambio(user),
    );
  }
}
