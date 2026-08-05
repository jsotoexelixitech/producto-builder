import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import {
  CreateProductDto,
  SetCatalogVisibilityDto,
  UpdateProductDto,
} from './dto/product.dto';
import { ProductMutableGuard } from '../common/guards/product-mutable.guard';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(ProductMutableGuard)
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  /** Sin ProductMutableGuard: la visibilidad en catálogo no altera el producto regulatorio. */
  @Patch(':id/catalog-visibility')
  setCatalogVisibility(
    @Param('id') id: string,
    @Body() dto: SetCatalogVisibilityDto,
  ) {
    return this.productsService.setCatalogVisibility(id, dto.visible);
  }

  @Delete(':id')
  @UseGuards(ProductMutableGuard)
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
