import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Component({ selector: 'app-treasury-account-selector', standalone: true, imports: [FormsModule],
  template: `<label>Tài khoản công ty ghi nhận thu/chi
    <select [ngModel]="value" (ngModelChange)="valueChange.emit($event)">
      <option value="">Chọn tài khoản trong Sổ kinh doanh</option>
      @for (account of accounts; track account._id) {
        <option [value]="account._id">{{ account.code }} — {{ account.name }}</option>
      }
    </select>
  </label>
  @if (error) { <p role="alert">{{ error }}</p> }`,
  styles: ['label{display:block;margin:12px 0}select{display:block;width:100%;padding:10px;margin-top:6px}'],
})
export class TreasuryAccountSelectorComponent implements OnInit {
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();
  accounts: Array<{_id: string; code: string; name: string}> = [];
  error = '';
  private http = inject(HttpClient);
  ngOnInit() {
    this.http.get<typeof this.accounts>(`${environment.apiUrl}/finance/business-ledger/accounts`).subscribe({
      next: accounts => {
        this.accounts = accounts;
        if (!this.value && accounts.length === 1) this.valueChange.emit(accounts[0]._id);
        if (!accounts.length) this.error = 'Cần khai báo tài khoản và số dư đầu kỳ trong Sổ kinh doanh.';
      },
      error: () => this.error = 'Không tải được tài khoản. Kiểm tra quyền truy cập Sổ kinh doanh.',
    });
  }
}
