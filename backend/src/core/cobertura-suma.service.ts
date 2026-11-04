import { BadRequestException, Injectable } from '@nestjs/common';
import { TipoSumaAsegurada } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertCoberturaSumaDto } from './dto/cobertura-suma.dto';

export const UNIDAD_CALCULO_DEFAULT = 'Unidad de cálculo';

const limpio = (v: string | undefined) => (v ?? '').trim();

/**
 * Suma asegurada por cobertura de Sis2000 (cramo + ccobertura): FIJA (comportamiento de hoy) o CALCULADA
 * al emitir (unidades × valor por unidad). Vive en la Postgres propia del configurador porque Sis2000 no
 * tiene columnas para esto y no se alteran sus tablas ni SPs.
 */
@Injectable()
export class CoberturaSumaService {
  constructor(private readonly prisma: PrismaService) {}

  listByRamo(cramo: number) {
    return this.prisma.coberturaSumaConfig.findMany({
      where: { cramo },
      orderBy: { ccobertura: 'asc' },
    });
  }

  get(cramo: number, ccobertura: string) {
    return this.prisma.coberturaSumaConfig.findUnique({
      where: { cramo_ccobertura: { cramo, ccobertura: ccobertura.trim().toUpperCase() } },
    });
  }

  async upsert(cramo: number, ccobertura: string, dto: UpsertCoberturaSumaDto) {
    const codigo = ccobertura.trim().toUpperCase();
    const calculada = dto.tipoSuma === TipoSumaAsegurada.CALCULADA;
    const etiquetaCuadro = limpio(dto.etiquetaCuadro);
    if (calculada && !etiquetaCuadro) {
      throw new BadRequestException('Con suma calculada al emitir la etiqueta del cuadro póliza es obligatoria.');
    }
    const datos = {
      tipoSuma: dto.tipoSuma,
      unidadCalculo: calculada ? limpio(dto.unidadCalculo) || UNIDAD_CALCULO_DEFAULT : null,
      etiquetaCuadro: calculada ? etiquetaCuadro : null,
    };
    return this.prisma.coberturaSumaConfig.upsert({
      where: { cramo_ccobertura: { cramo, ccobertura: codigo } },
      create: { cramo, ccobertura: codigo, ...datos },
      update: datos,
    });
  }
}
