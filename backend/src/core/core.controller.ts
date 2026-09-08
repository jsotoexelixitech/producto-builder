import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ProductBranch } from '@prisma/client';
import { CoreService } from './core.service';
import {
  CreateCoreCoverageDto,
  ImportCoreProductDto,
  ListCoreCoveragesQueryDto,
  ListSubBranchesQueryDto,
} from './dto/core.dto';
import { Sis2000ProductDto } from './dto/sis2000.dto';
import {
  GetSis2000PlanDetailQueryDto,
  ListSis2000PlansQueryDto,
} from './dto/sis2000-plans.dto';

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

  @Get('sis2000/products')
  listSis2000Products() {
    return this.coreService.listSis2000Products();
  }

  @Get('sis2000/products/:cproducto')
  getSis2000Product(@Param('cproducto') cproducto: string) {
    return this.coreService.getSis2000Product(cproducto);
  }

  @Post('sis2000/products')
  createSis2000Product(@Body() dto: Sis2000ProductDto) {
    return this.coreService.createSis2000Product(dto);
  }

  @Put('sis2000/products/:cproducto')
  updateSis2000Product(
    @Param('cproducto') cproducto: string,
    @Body() dto: Sis2000ProductDto,
  ) {
    return this.coreService.updateSis2000Product(cproducto, dto);
  }

  @Get('sis2000/products/:cproducto/plans')
  listSis2000ProductPlans(
    @Param('cproducto') cproducto: string,
    @Query() query: ListSis2000PlansQueryDto,
  ) {
    return this.coreService.listSis2000ProductPlans(
      cproducto,
      query.centidad,
      query.citem,
    );
  }

  @Get('sis2000/plans/detail')
  getSis2000PlanDetail(@Query() query: GetSis2000PlanDetailQueryDto) {
    return this.coreService.getSis2000PlanDetail(query.cramo, query.cplan);
  }
}
