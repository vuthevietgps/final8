/**
 * File:@Controller('ad-group')
export class AdGroupController {
  constructor(
    private readonly adGroupService: AdGroupService,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>
  ) {}-group/ad-group.controller.ts
 * Mục đích: REST API cho Nhóm Quảng Cáo với tích hợp chatbot
 * Chức năng: CRUD ad groups, lấy products theo category, webhook lookup, auto-discover
 */
import { Controller, Get, Post, Body, Patch, Param, Delete, Query, BadRequestException, Inject } from '@nestjs/common';
import { AdGroupService } from './ad-group.service';
import { CreateAdGroupDto } from './dto/create-ad-group.dto';
import { UpdateAdGroupDto } from './dto/update-ad-group.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import { AdGroupRecommendationService } from './ad-group.recommendation.service';
import { AdGroupSyncService } from './ad-group.sync.service';

@Controller('ad-groups')
export class AdGroupController {
  constructor(
    private readonly adGroupService: AdGroupService,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private readonly recommendationService: AdGroupRecommendationService,
    private readonly syncService: AdGroupSyncService,
  ) {}

  @Post()
  create(@Body() dto: CreateAdGroupDto) {
  return this.adGroupService.create(dto);
  }

  @Get()
  findAll(@Query() query?: any) {
    return this.adGroupService.findAll(query);
  }

  @Get('search')
  search(@Query() query?: any) {
    return this.adGroupService.search(query);
  }

  @Get('validate/adgroupid/:adGroupId')
  async validateAdGroupId(@Param('adGroupId') adGroupId: string) {
    const exists = await this.adGroupService.existsByAdGroupId(adGroupId);
    return { exists };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adGroupService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAdGroupDto) {
    return this.adGroupService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.adGroupService.remove(id);
  }

  // Đề xuất chi phí quảng cáo (AI gợi ý)
  @Get('recommendations')
  async getRecommendations() {
    return this.recommendationService.computeRecommendations();
  }

  @Post('recommendations/apply')
  async applyRecommendations(@Body() body: { ids: string[] }) {
    return this.recommendationService.applyRecommendations(body?.ids || []);
  }

  /**
   * Thống kê số lượng nhóm quảng cáo theo sản phẩm
   */
  @Get('stats/counts-by-product')
  getCountsByProduct() {
    return this.adGroupService.getCountsByProduct();
  }

  /**
   * Lấy products theo product category
   * Dùng cho form chọn sản phẩm khi tạo/sửa ad group
   */
  @Get('products-by-category/:categoryId')
  async getProductsByCategory(@Param('categoryId') categoryId: string) {
    try {
      const products = await this.productModel
        .find({ 
          productCategoryId: categoryId,
          isActive: { $ne: false }
        })
        .select('name description price image isActive')
        .sort({ name: 1 })
        .lean();

      return {
        success: true,
        data: products,
        count: products.length
      };
    } catch (error) {
      throw new BadRequestException(`Lỗi lấy products theo category: ${error.message}`);
    }
  }

  /**
   * Lấy ad groups theo fanpage
   * Dùng cho webhook processing
   */
  @Get('by-fanpage/:fanpageId')
  async getAdGroupsByFanpage(
    @Param('fanpageId') fanpageId: string,
    @Query('enableWebhook') enableWebhook?: string
  ) {
    try {
      const filter: any = { fanpageId };
      
      if (enableWebhook === 'true') {
        filter.enableWebhook = true;
      }

      const adGroups = await this.adGroupService.findAll(filter);
      
      return {
        success: true,
        data: adGroups,
        count: adGroups.length
      };
    } catch (error) {
      throw new BadRequestException(`Lỗi lấy ad groups theo fanpage: ${error.message}`);
    }
  }

  /**
   * Lookup ad group cho webhook processing
   * Tìm theo adGroupId và fanpageId
   */
  @Get('webhook-lookup/:adGroupId/:fanpageId')
  async webhookLookup(
    @Param('adGroupId') adGroupId: string,
    @Param('fanpageId') fanpageId: string
  ) {
    try {
      const adGroup = await this.adGroupService.findByAdGroupIdAndFanpage(adGroupId, fanpageId);
      
      if (!adGroup) {
        return {
          success: false,
          message: 'Không tìm thấy ad group hoặc webhook chưa được kích hoạt'
        };
      }

      return {
        success: true,
        data: adGroup
      };
    } catch (error) {
      throw new BadRequestException(`Lỗi webhook lookup: ${error.message}`);
    }
  }

  /**
   * Cập nhật trạng thái webhook cho ad group
   */
  @Patch(':id/webhook-status')
  async updateWebhookStatus(
    @Param('id') id: string,
    @Body() body: { enableWebhook: boolean }
  ) {
    try {
      const updated = await this.adGroupService.update(id, {
        enableWebhook: body.enableWebhook
      });

      return {
        success: true,
        data: updated,
        message: `Cập nhật trạng thái webhook thành công`
      };
    } catch (error) {
      throw new BadRequestException(`Lỗi cập nhật webhook status: ${error.message}`);
    }
  }

  // Lookup Ad Group by ID for chat message display
  @Get('lookup/:adGroupId')
  async lookupAdGroup(@Param('adGroupId') adGroupId: string) {
    try {
      // Use findAll with adGroupId filter to find the ad group
      const adGroups = await this.adGroupService.findAll({ adGroupId });
      const adGroup = adGroups.length > 0 ? adGroups[0] : null;
      
      if (!adGroup) {
        return { adGroupId, name: 'Unknown Ad Group', found: false };
      }
      return { 
        adGroupId: adGroup.adGroupId, 
        name: adGroup.name, 
        found: true,
        productCount: adGroup.selectedProducts?.length || 0
      };
    } catch (error) {
      return { adGroupId, name: 'Error', found: false, error: error.message };
    }
  }

  // ==========================================
  // AUTO-DISCOVER & SYNC ENDPOINTS
  // ==========================================

  /**
   * Lấy trạng thái sync của tất cả ad accounts
   */
  @Get('sync/status')
  async getSyncStatus() {
    return this.syncService.getSyncStatus();
  }

  /**
   * Auto-discover: Lấy danh sách ad groups từ Facebook cho 1 ad account
   * Trả về danh sách để nhân viên xem và chọn import
   */
  @Get('discover/:adAccountId')
  async discoverAdGroups(@Param('adAccountId') adAccountId: string) {
    return this.syncService.discoverAdGroupsFromFacebook(adAccountId);
  }

  /**
   * Auto-import: Tự động tạo ad groups đã chọn vào hệ thống
   * Body: { adAccountId, adGroupIds[], fanpageId, productCategoryId, agentId }
   */
  @Post('import')
  async importAdGroups(@Body() body: {
    adAccountId: string;
    adGroupIds: string[];
    fanpageId: string;
    productCategoryId: string;
    agentId: string;
  }) {
    if (!body.adAccountId || !body.adGroupIds?.length || !body.fanpageId || !body.productCategoryId || !body.agentId) {
      throw new BadRequestException('Thiếu thông tin bắt buộc: adAccountId, adGroupIds, fanpageId, productCategoryId, agentId');
    }
    return this.syncService.autoImportAdGroups(body);
  }

  /**
   * Trigger sync thủ công cho 1 ad account
   */
  @Post('sync/:adAccountId')
  async triggerSync(@Param('adAccountId') adAccountId: string) {
    // Trigger sync cho account này
    await this.syncService.cronSyncFacebook();
    return { success: true, message: 'Đã trigger sync' };
  }
}
