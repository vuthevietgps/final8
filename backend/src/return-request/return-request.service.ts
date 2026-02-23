import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { InventoryService } from '../inventory/inventory.service';
import { CreateReturnRequestDto } from './dto/create-return-request.dto';
import { ResolveReturnRequestDto } from './dto/resolve-return-request.dto';
import { ReturnRequest, ReturnRequestDocument } from './return-request.schema';

@Injectable()
export class ReturnRequestService {
  constructor(
    @InjectModel(ReturnRequest.name) private model: Model<ReturnRequestDocument>,
    private readonly inventory: InventoryService,
  ) {}

  async create(dto: CreateReturnRequestDto) {
    if (!dto.items?.length) throw new BadRequestException('Cần ít nhất 1 dòng hàng hoàn');
    const doc = await this.model.create({
      orderId: new Types.ObjectId(dto.orderId),
      supplierId: dto.supplierId ? new Types.ObjectId(dto.supplierId) : undefined,
      items: dto.items.map(it => ({
        productId: new Types.ObjectId(it.productId),
        quantityReturned: Number(it.quantityReturned),
        notes: it.notes,
      })),
      reason: dto.reason,
      status: 'pending',
    });
    return doc.toObject();
  }

  async findOne(id: string) {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException('Không tìm thấy phiếu hàng hoàn');
    return doc;
  }

  async resolve(id: string, dto: ResolveReturnRequestDto) {
    const session = await this.model.db.startSession();
    let result: any;
    await session.withTransaction(async () => {
      const doc = await this.model.findById(id).session(session);
      if (!doc) throw new NotFoundException('Không tìm thấy phiếu hàng hoàn');
      if (doc.status === 'resolved') throw new BadRequestException('Phiếu đã xử lý');

      const byId = new Map<string, any>();
      for (const it of dto.items || []) {
        byId.set(String(it.itemId), it);
      }

      const restock: Array<{ productId: string; quantity: number; recoveryUnitCost: number }> = [];

      doc.items = (doc.items || []).map((it: any) => {
        const payload = byId.get(String((it as any)._id));
        if (!payload) return it;
        const decision = payload.decision;
        const qty = Number(payload.quantity ?? it.quantityReturned);
        if (qty <= 0) throw new BadRequestException('Số lượng phải > 0');
        if (qty > Number(it.quantityReturned)) throw new BadRequestException('Số lượng vượt quá hàng hoàn');

        if (decision === 'restock') {
          const recoveryUnitCost = Number(payload.recoveryUnitCost ?? 0);
          restock.push({ productId: String(it.productId), quantity: qty, recoveryUnitCost });
          it.decision = 'restock';
          it.processedQuantity = qty;
          it.recoveryUnitCost = recoveryUnitCost;
        } else if (decision === 'scrap') {
          it.decision = 'scrap';
          it.processedQuantity = qty;
        } else {
          throw new BadRequestException('Quyết định không hợp lệ');
        }
        return it;
      }) as any;

      if (!restock.length && !(dto.items || []).length) {
        throw new BadRequestException('Chưa có quyết định xử lý');
      }

      if (restock.length) {
        await this.inventory.recordReturnFromRMA(restock, dto.reason, session as ClientSession);
      }

      doc.status = 'resolved';
      doc.resolvedAt = new Date();
      await doc.save({ session });
      result = doc.toObject();
    });
    await session.endSession();
    return result;
  }
}
