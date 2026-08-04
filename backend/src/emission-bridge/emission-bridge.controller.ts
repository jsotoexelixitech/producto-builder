import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { Public } from '../common/decorators/public.decorator';
import { EmitPolicyBridgeDto, QuoteBridgeDto } from './dto/emit-policy.dto';
import { EmissionBridgeService } from './emission-bridge.service';

@ApiTags('Emisión (puente nest-api + OCR)')
@ApiBearerAuth()
@Controller('emission')
export class EmissionBridgeController {
  constructor(private readonly bridge: EmissionBridgeService) {}

  @Post('quote')
  @Public()
  @ApiOperation({ summary: 'Cotizar vía nest-api product-emission' })
  quote(@Body() dto: QuoteBridgeDto) {
    return this.bridge.quote(dto);
  }

  @Post('validate')
  @Public()
  @ApiOperation({ summary: 'Validar producto/plan antes de emitir' })
  validate(@Body() dto: QuoteBridgeDto) {
    return this.bridge.validate(dto);
  }

  @Post('emit')
  @Public()
  @ApiOperation({
    summary: 'Emitir póliza genérica (simula pago si EMISION_GARANTIZADA)',
  })
  emit(@Body() dto: EmitPolicyBridgeDto) {
    return this.bridge.emit(dto);
  }

  @Post('ocr/upload')
  @Public()
  @ApiOperation({ summary: 'Proxy OCR → modulo-ocr/documents/upload' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  uploadOcr(
    @UploadedFile() file: Express.Multer.File,
    @Body('docType') docType: string,
  ) {
    return this.bridge.proxyOcrUpload(file, docType);
  }

  @Get('documents/:filename')
  @Public()
  @ApiOperation({ summary: 'Proxy PDF cuadro-póliza (inline en navegador)' })
  async getDocument(
    @Param('filename') filename: string,
    @Query('download') download: string,
    @Res() res: Response,
  ) {
    const upstream = await this.bridge.proxyDocument(
      filename,
      download === 'true',
    );
    const contentType = upstream.headers.get('content-type');
    const disposition = upstream.headers.get('content-disposition');
    if (contentType) res.setHeader('Content-Type', contentType);
    if (disposition) res.setHeader('Content-Disposition', disposition);
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  }
}
