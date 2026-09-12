import { BadRequestException, ConflictException, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FinanceEvents } from '../finance/events/finance-events.constants';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CounterpartyLedgerService } from './counterparty-ledger.service';
import { DebtScheduleRevision } from './debt-schedule.schema';
import { SaveDebtScheduleDto } from './debt-schedule.dto';
import { validScheduleDay } from './debt-schedule.rules';

@Injectable()
export class DebtScheduleService implements OnModuleInit {
  constructor(@InjectModel(DebtScheduleRevision.name) private revisions: Model<DebtScheduleRevision>,
    private counterparties: CounterpartyLedgerService, @Optional() private events?: EventEmitter2) {}
  async onModuleInit() { await this.revisions.createIndexes(); }
  private refresh(dto: SaveDebtScheduleDto) {
    const supplier = dto.partyKey.startsWith('supplier:');
    try { this.events?.emit(supplier ? FinanceEvents.SUPPLIER_PAYABLE_UPDATED : FinanceEvents.AGENT_RECEIVABLE_UPDATED,
      { recordId: dto.orderId, [supplier ? 'supplierId' : 'agentId']: dto.partyKey.split(':')[1], amountChanged: false }); }
    catch { Logger.warn('Lịch công nợ đã lưu; cần tải lại báo cáo tài chính.', 'DebtSchedule'); }
  }

  async save(dto: SaveDebtScheduleDto, actor: string) {
    if (!Types.ObjectId.isValid(actor)) throw new BadRequestException('Người ghi lịch không hợp lệ.');
    if (!dto.evidence?.trim() || !dto.reason?.trim()) throw new BadRequestException('Cần căn cứ và lý do thay đổi lịch.');
    for (const date of [dto.dueDate, dto.promisedDate])
      if (date !== null && !validScheduleDay(date)) throw new BadRequestException('Ngày phải hợp lệ theo YYYY-MM-DD hoặc null khi chưa rõ.');
    const requestHash = this.counterparties.hash([dto]);
    const previous = await this.revisions.findOne({ requestKey: dto.requestKey }).lean();
    if (previous) {
      if (previous.requestHash !== requestHash) throw new ConflictException('Mã yêu cầu đã dùng cho nội dung khác.');
      this.refresh(dto);
      return previous;
    }
    const snapshot = await this.counterparties.snapshot(dto.partyKey);
    if (snapshot.sourceHash !== dto.sourceHash) throw new ConflictException('Công nợ đã thay đổi; tải lại trước khi ghi lịch.');
    const row = snapshot.rows.find(r => r.orderId === dto.orderId);
    if (!row || !row.context || row.reviewReasons.length) throw new BadRequestException('Khoản công nợ chưa đủ căn cứ; cần đối chiếu nguồn trước khi ghi lịch.');
    const actualDirection = row.balance > 0 ? 'receivable' : row.balance < 0 ? 'payable' : null;
    if (actualDirection !== dto.direction) throw new ConflictException('Chiều công nợ đã đổi hoặc khoản đã tất toán; tải lại số liệu.');
    const latest = await this.revisions.findOne({ partyKey: dto.partyKey, orderId: dto.orderId, direction: dto.direction })
      .sort({ revision: -1 }).lean();
    if ((latest?.revision ?? 0) !== dto.expectedRevision) throw new ConflictException('Lịch đã được người khác cập nhật; tải lại lịch mới nhất.');
    try {
      const saved = await this.revisions.create({ ...dto, revision: dto.expectedRevision + 1,
        requestHash, recordedAt: new Date(), createdBy: actor, balanceAtRevision: row.balance,
        evidence: dto.evidence.trim(), reason: dto.reason.trim() });
      this.refresh(dto);
      return saved;
    } catch (error) {
      if (error.code === 11000) {
        const retry = await this.revisions.findOne({ requestKey: dto.requestKey }).lean();
        if (retry?.requestHash === requestHash) { this.refresh(dto); return retry; }
        throw new ConflictException('Lịch vừa được cập nhật; tải lại trước khi ghi tiếp.');
      }
      throw error;
    }
  }
}
