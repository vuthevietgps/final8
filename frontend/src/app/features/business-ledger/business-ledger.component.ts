import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { dealerReturnPolicyLabel } from '../../shared/dealer-return-policy';

@Component({
  selector: 'app-business-ledger',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './business-ledger.component.html',
  styleUrl: './business-ledger.component.css',
})
export class BusinessLedgerComponent implements OnInit {
  readonly dealerPolicyLabel = dealerReturnPolicyLabel;
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly api = `${environment.apiUrl}/finance/business-ledger`;
  report = signal<any>(null);
  accounts = signal<any[]>([]);
  pending = signal<any[]>([]);
  detail = signal<any>(null);
  busy = signal(false);
  error = signal('');
  message = signal('');
  from = new Date(Date.now() - 29 * 86400000).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  to = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  view: 'productCategories' | 'products' | 'agents' | 'adGroups' | 'orders' | 'debts' = 'productCategories';
  orderId = '';
  purchaseOrderId = '';
  purchases: any[] = [];
  get availableKinds() { return this.purchaseOrderId ? this.kinds.filter(k=>k[0]==='payment') : this.detail()?.order?.financialModelVersion === 2 ? this.kinds.filter(k=>!['sale','direct_cost','inventory_cost','inventory_recovery','returned_stock','dealer_cost_recovery','opening_receivable','opening_payable'].includes(k[0])) : this.kinds; }
  saleMode = 'retail';
  fulfillment = 'supplier_direct';
  returnPolicy = 'unconfigured';
  profileEvidence = '';
  draftKey = crypto.randomUUID();
  entry = this.emptyEntry();
  account = { code: '', name: '', openingBalance: 0, openingAt: this.localNow(), evidence: '' };
  readonly kinds = [
    ['sale', 'Ghi nhận bán hàng'],
    ['sale_credit', 'Giảm doanh thu / hoàn bán'],
    ['direct_cost', 'Giá vốn và nợ NCC giao trực tiếp'],
    ['supplier_credit', 'NCC xác nhận giảm nợ / nhận lại hàng'],
    ['inventory_cost', 'Giá vốn xuất kho'],
    ['inventory_recovery', 'Thu hồi giá vốn hàng về kho'],
    ['returned_stock', 'Hàng hoàn nhập kho công ty — giữ nguyên nợ NCC'],
    ['expense', 'Chi phí công ty phải chịu'],
    ['expense_credit', 'Giảm chi phí đã ghi nhận'],
    ['dealer_cost_recovery', 'Phí đại lý chịu — thu bù chi phí đã ghi'],
    ['opening_receivable', 'Công nợ đầu kỳ: còn phải thu'],
    ['opening_payable', 'Công nợ đầu kỳ: còn phải trả'],
    ['cash_adjustment_in', 'Điều chỉnh kiểm quỹ: tăng số dư'],
    ['cash_adjustment_out', 'Điều chỉnh kiểm quỹ: giảm số dư'],
    ['payment', 'Thu / chi / chuyển tiền / thu hộ'],
  ];
  readonly parties = [
    ['company', 'Công ty'],
    ['customer', 'Khách cuối'],
    ['supplier', 'Nhà cung cấp'],
    ['agent', 'Đại lý'],
    ['other', 'Đối tác khác'],
  ];
  readonly states: Record<string, string> = {
    draft: 'Chờ xác nhận',
    confirmed: 'Đã xác nhận',
    rejected: 'Đã từ chối',
    unreviewed: 'Chưa đủ nghiệp vụ',
    pending_confirmation: 'Chờ đối soát',
    settled: 'Đã tất toán theo sổ',
    partial: 'Còn dư sau giao dịch',
    outstanding: 'Chưa thanh toán',
  };
  ngOnInit() {
    this.orderId = this.route.snapshot.queryParamMap.get('orderId') || '';
    this.reload();
    if (this.orderId) this.loadOrder();
  }
  localNow() {
    const d = new Date();
    return new Date(+d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  emptyEntry() {
    return {
      kind: 'payment',
      amount: 0,
      occurredAt: this.localNow(),
      evidence: '',
      description: '',
      fromParty: 'customer',
      toParty: 'company',
      fromAccountId: '',
      toAccountId: '',
      expenseParty: 'supplier',
      otherParty: '',
      settlesDebt: false,
      orderLinked: true,
    };
  }
  label(kind: string) {
    return (
      this.kinds.find((k) => k[0] === kind)?.[1] || (kind === 'reversal' ? 'Đảo nghiệp vụ' : kind)
    );
  }
  state(value: string) {
    return this.states[value] || value;
  }
  amount(value: number | null | undefined) {
    return value == null ? 'Chưa xác lập' : `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
  }
  failure(error: any) {
    const value = error?.error?.message;
    this.error.set(
      Array.isArray(value)
        ? value.join(' · ')
        : typeof value === 'string'
          ? value
          : 'Không thể xử lý. Vui lòng thử lại.',
    );
    this.busy.set(false);
  }
  reload() {
    this.error.set('');
    forkJoin({
      purchases: this.http.get<any[]>(`${this.api}/purchases`),
      report: this.http.get<any>(`${this.api}/report`, {
        params: { from: this.from, to: this.to },
      }),
      accounts: this.http.get<any[]>(`${this.api}/accounts`),
      pending: this.http.get<any[]>(`${this.api}/pending`),
    }).subscribe({
      next: (data) => {
        this.report.set(data.report);
        this.purchases=data.purchases;
        this.accounts.set(data.accounts);
        this.pending.set(data.pending);
      },
      error: (e) => this.failure(e),
    });
  }
  loadOrder() {
    if (!/^[a-f\d]{24}$/i.test(this.orderId)) {
      this.error.set('Chọn đơn hoặc nhập mã đơn 24 ký tự.');
      return;
    }
    this.detail.set(null);
    this.http.get<any>(`${this.api}/orders/${this.orderId}`).subscribe({
      next: (data) => {
        this.detail.set(data);
        this.error.set('');
        this.saleMode =
          data.profile?.context.saleMode || data.order.saleMode || 'retail';
        this.fulfillment = data.profile?.context.fulfillment || (data.order.productSource && data.order.productSource !== 'supplier' ? 'inventory' : 'supplier_direct');
        this.returnPolicy = data.profile?.context.returnPolicy || (data.order.financialModelVersion===2 ? 'production_committed' : data.suggestions.returnPolicy);
      },
      error: (e) => this.failure(e),
    });
  }
  mutate(request: Observable<any>, success: string, callback?: () => void) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.message.set(success);
        callback?.();
        this.reload();
        if (this.detail()) this.loadOrder();
      },
      error: (e) => this.failure(e),
    });
  }
  createProfile() {
    this.mutate(
      this.http.post(`${this.api}/profiles`, {
        orderId: this.orderId,
        saleMode: this.saleMode,
        fulfillment: this.fulfillment,
        returnPolicy: this.returnPolicy,
        evidence: this.profileEvidence,
      }),
      'Đã xác nhận mô hình đơn. Chưa ghi nhận thu tiền.',
    );
  }
  createAccount() {
    if (!this.account.openingAt) return;
    this.mutate(
      this.http.post(`${this.api}/accounts`, {
        ...this.account,
        openingAt: new Date(this.account.openingAt).toISOString(),
      }),
      'Đã khai báo số dư đầu kỳ. Chỉ ghi giao dịch phát sinh sau mốc này.',
      () =>
        (this.account = {
          code: '',
          name: '',
          openingBalance: 0,
          openingAt: this.localNow(),
          evidence: '',
        }),
    );
  }
  saveEntry() {
    if (!this.entry.occurredAt) return;
    const e = this.entry;
    const body: any = {
      idempotencyKey: this.draftKey,
      kind: e.kind,
      amount: Number(e.amount),
      occurredAt: new Date(e.occurredAt).toISOString(),
      evidence: e.evidence,
      description: e.description,
    };
    if(this.purchaseOrderId) { body.purchaseOrderId=this.purchaseOrderId; }
    else if (e.orderLinked) {
      if (!this.detail()?.profile || this.detail()?.order?.id !== this.orderId) {
        this.error.set('Tải và xác nhận mô hình đơn trước khi ghi nghiệp vụ.');
        return;
      }
      body.orderId = this.orderId;
    }
    if (e.kind === 'payment') {
      body.fromParty = e.fromParty;
      body.toParty = e.toParty;
      if (e.fromParty === 'company') body.fromAccountId = e.fromAccountId;
      if (e.toParty === 'company') body.toAccountId = e.toAccountId;
      body.settlesDebt = e.settlesDebt;
    }
    if (e.kind === 'cash_adjustment_in') body.toAccountId = e.toAccountId;
    if (e.kind === 'cash_adjustment_out') body.fromAccountId = e.fromAccountId;
    if (['expense', 'expense_credit', 'opening_receivable', 'opening_payable'].includes(e.kind))
      body.expenseParty = e.expenseParty;
    if (e.otherParty.trim()) body.otherParty = e.otherParty.trim();
    this.mutate(
      this.http.post(`${this.api}/entries`, body),
      'Đã lưu chờ xác nhận. Chưa thay đổi tiền hoặc công nợ.',
      () => {
        this.draftKey = crypto.randomUUID();
        this.entry = this.emptyEntry();
      },
    );
  }
  resetEntry() {
    this.draftKey = crypto.randomUUID();
    this.entry = this.emptyEntry();
  }
  confirm(entry: any) {
    this.mutate(
      this.http.post(`${this.api}/entries/${entry._id}/confirm`, {}),
      'Đã xác nhận nghiệp vụ vào sổ.',
    );
  }
  reject(entry: any) {
    const reason = window.prompt('Lý do từ chối nghiệp vụ:');
    if (reason?.trim())
      this.mutate(
        this.http.post(`${this.api}/entries/${entry._id}/reject`, { reason }),
        'Đã từ chối; lịch sử được giữ lại.',
      );
  }
  reverse(entry: any) {
    const reason = window.prompt('Lý do và chứng từ sửa sai:');
    if (!reason?.trim()) return;
    this.mutate(
      this.http.post(`${this.api}/entries`, {
        idempotencyKey: crypto.randomUUID(),
        kind: 'reversal',
        amount: entry.amount,
        reversalOf: entry._id,
        occurredAt: new Date().toISOString(),
        evidence: reason,
        description: `Đảo: ${entry.description}`.slice(0, 500),
      }),
      'Đã tạo bút toán đảo chờ xác nhận.',
    );
  }
}
