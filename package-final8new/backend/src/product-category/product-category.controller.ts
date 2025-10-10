/**
 * File: product-category.controller.ts
 * Mục đích: REST API CRUD cho Nhóm Sản phẩm.
 */
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ProductCategoryService } from './product-category.service';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';

@Controller('product-category')
export class ProductCategoryController {
  constructor(private readonly productCategoryService: ProductCategoryService) {}

  @Post()
  create(@Body() createProductCategoryDto: CreateProductCategoryDto) {
    return this.productCategoryService.create(createProductCategoryDto);
  }

  @Get()
  findAll() {
    return this.productCategoryService.findAll();
  }

  @Get('active')
  getActiveCategories() {
    return this.productCategoryService.getActiveCategories();
  }

  @Get('stats/summary')
  getStatsSummary() {
    return this.productCategoryService.getStatsSummary();
  }

  @Post('seed')
  @HttpCode(HttpStatus.CREATED)
  seedSampleData() {
    return this.productCategoryService.seedSampleData();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productCategoryService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductCategoryDto: UpdateProductCategoryDto) {
    return this.productCategoryService.update(id, updateProductCategoryDto);
  }

  @Patch(':id/product-count')
  updateProductCount(@Param('id') id: string, @Body('count') count: number) {
    return this.productCategoryService.updateProductCount(id, count);
  }

  @Patch(':id/order')
  updateOrder(@Param('id') id: string, @Body('order') order: number) {
    return this.productCategoryService.updateOrder(id, order);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.productCategoryService.remove(id);
  }
}
