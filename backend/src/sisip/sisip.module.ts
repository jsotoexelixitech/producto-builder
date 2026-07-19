import { Module } from '@nestjs/common';
import { SisipController } from './sisip.controller';
import { SisipService } from './sisip.service';

@Module({
  controllers: [SisipController],
  providers: [SisipService],
  exports: [SisipService],
})
export class SisipModule {}
