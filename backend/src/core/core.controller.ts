import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ProductBranch } from '@prisma/client';
import { CoreService } from './core.service';
import {
  CreateCoreCoverageDto,
  ImportCoreProductDto,
  ListCoreCoveragesQueryDto,
  ListSubBranchesQueryDto,
} from './dto/core.dto';

@Controller('core')
export class CoreController {
  constructor(private readonly coreService: CoreService) {}

  @Get('subramos')
  listSubBranches(@Query() query: ListSubBranchesQueryDto) {
    return this.coreService.listSubBranches(query.branch);
  }

  @Get('coverages')
  listCoverages(@Query() query: ListCoreCoveragesQueryDto) {
    return this.coreService.listCoverages(query.branch, query.subBranchCode);
  }

  @Post('coverages')
  createCoverage(@Body() dto: CreateCoreCoverageDto) {
    return this.coreService.createCoverage(dto);
  }

  @Get('products')
  listCoreProducts(@Query('branch') branch?: ProductBranch) {
    return this.coreService.listCoreProducts(branch);
  }

  @Post('products/import')
  importProduct(@Body() dto: ImportCoreProductDto) {
    return this.coreService.importProductFromCore(dto.coreCode);
  }

  @Post('products/:productId/sync')
  syncProduct(@Param('productId') productId: string) {
    return this.coreService.syncProductToCore(productId);
  }
}
