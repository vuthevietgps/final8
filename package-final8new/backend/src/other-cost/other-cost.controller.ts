/**
 * File: other-cost/other-cost.controller.ts
 * Mục đích: REST API cho Chi Phí Khác (CRUD + thống kê tổng tiền).
 */
import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ValidationPipe, HttpCode, HttpStatus, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { OtherCostService } from './other-cost.service';
import { CreateOtherCostDto } from './dto/create-other-cost.dto';
import { UpdateOtherCostDto } from './dto/update-other-cost.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';

@Controller('other-cost')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OtherCostController {
  constructor(private readonly otherCostService: OtherCostService) {}

  /**
   * Tạo mới chi phí khác
   */
  @Post()
  @RequirePermissions('other-costs')
  @HttpCode(HttpStatus.CREATED)
  create(@Body(ValidationPipe) dto: CreateOtherCostDto) {
    return this.otherCostService.create(dto);
  }

  /**
   * Danh sách chi phí: hỗ trợ lọc theo khoảng ngày (from, to) dạng ISO-8601
   */
  @Get()
  @RequirePermissions('other-costs')
  findAll(@Query('from') from?: string, @Query('to') to?: string) {
    return this.otherCostService.findAll(from, to);
  }

  /**
   * Thống kê tổng tiền và số bản ghi theo filter thời gian
   * GET /other-cost/summary?from=...&to=...
   */
  @Get('summary')
  @RequirePermissions('other-costs')
  getSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.otherCostService.getSummary(from, to);
  }

  /**
   * Xuất CSV danh sách chi phí theo khoảng thời gian (tùy chọn)
   * GET /other-cost/export/csv?from=YYYY-MM-DD&to=YYYY-MM-DD
   */
  @Get('export/csv')
  @RequirePermissions('other-costs')
  async exportToCSV(
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const items = await this.otherCostService.findAll(from, to);

    const headers = [
      'Ngày',
      'Chi phí',
      'Ghi chú',
      'Link chứng từ',
      'Created At',
      'Updated At',
    ];

    const esc = (val: any) => {
      if (val === null || val === undefined) return '';
      const s = String(val).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };

    const rows = items.map((c) => [
      c.date ? new Date(c.date).toISOString().slice(0, 10) : '',
      c.amount ?? '',
      c.notes ?? '',
      c.documentLink ?? '',
      c.createdAt ? new Date(c.createdAt).toISOString() : '',
      c.updatedAt ? new Date(c.updatedAt).toISOString() : '',
    ]);

    const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');

    const filename = `other_costs_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // Thêm BOM để Excel hiển thị UTF-8 đúng
    res.status(HttpStatus.OK).send('\uFEFF' + csv);
  }

  /**
   * Chi tiết 1 chi phí
   */
  @Get(':id')
  @RequirePermissions('other-costs')
  findOne(@Param('id') id: string) {
    return this.otherCostService.findOne(id);
  }

  /**
   * Cập nhật chi phí
   */
  @Patch(':id')
  @RequirePermissions('other-costs')
  update(@Param('id') id: string, @Body(ValidationPipe) dto: UpdateOtherCostDto) {
    return this.otherCostService.update(id, dto);
  }

  /**
   * Xóa chi phí
   */
  @Delete(':id')
  @RequirePermissions('other-costs')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.otherCostService.remove(id);
  }
}
