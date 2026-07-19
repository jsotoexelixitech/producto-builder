import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CoveragesService } from './coverages.service';
import { CreateCoverageDto } from './dto/coverage.dto';
import { ProductMutableGuard } from '../common/guards/product-mutable.guard';

@Controller('products/:productId/coverages')
@UseGuards(ProductMutableGuard)
export class CoveragesController {
  constructor(private readonly coveragesService: CoveragesService) {}

  @Get()
  list(@Param('productId') productId: string) {
    return this.coveragesService.list(productId);
  }

  @Post()
  create(
    @Param('productId') productId: string,
    @Body() dto: CreateCoverageDto,
  ) {
    return this.coveragesService.create(productId, dto);
  }

  @Put()
  replaceAll(
    @Param('productId') productId: string,
    @Body() body: { coverages: CreateCoverageDto[] },
  ) {
    return this.coveragesService.replaceAll(productId, body.coverages);
  }

  @Delete(':coverageId')
  remove(
    @Param('productId') productId: string,
    @Param('coverageId') coverageId: string,
  ) {
    return this.coveragesService.remove(productId, coverageId);
  }
}
