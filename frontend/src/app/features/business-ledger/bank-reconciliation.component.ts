import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-bank-reconciliation',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './bank-reconciliation.component.html',
  styleUrl: './bank-reconciliation.component.css',
})
export class BankReconciliationComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/finance/business-ledger`;

  accounts: any[] = [];
  statements: any[] = [];
  report: any = null;
  busy = false;
  error = '';
  message = '';
  form = {
    accountId: '',
    statementKey: '',
    from: '',
    to: '',
    openingBalance: 0,
    closingBalance: 0,
    evidence: '',
    csv: 'externalId,occurredAt,amount,reference,description\n',
  };

  async ngOnInit() {
    await this.reload();
  }

  amount(value: number | null | undefined) {
    return value == null ? '—' : `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
  }

  private fail(error: any) {
    const value = error?.error?.message;
    this.error = Array.isArray(value)
      ? value.join(' · ')
      : typeof value === 'string'
        ? value
        : error?.message || 'Không thể xử lý yêu cầu.';
    this.busy = false;
  }

  async reload() {
    this.error = '';
    try {
      const [accounts, statements] = await Promise.all([
        firstValueFrom(this.http.get<any[]>(`${this.api}/accounts`)),
        firstValueFrom(this.http.get<any[]>(`${this.api}/bank-statements`)),
      ]);
      this.accounts = accounts;
      this.statements = statements;
      if (!this.form.accountId && accounts.length) this.form.accountId = String(accounts[0]._id);
    } catch (error) {
      this.fail(error);
    }
  }

  private csvRow(line: string) {
    const cells: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && quoted && line[i + 1] === '"') { cell += '"'; i++; continue; }
      if (char === '"') { quoted = !quoted; continue; }
      if (char === ',' && !quoted) { cells.push(cell.trim()); cell = ''; continue; }
      cell += char;
    }
    cells.push(cell.trim());
    return cells;
  }

  private csvLines() {
    const source = this.form.csv.split(/\r?\n/).filter((line) => line.trim());
    if (source.length && /external.?id/i.test(source[0])) source.shift();
    return source.map((line, index) => {
      const [externalId, occurredAt, rawAmount, reference = '', description = ''] = this.csvRow(line);
      const amount = Number(rawAmount?.replace(/[.\s]/g, '').replace(',', ''));
      if (!externalId || !occurredAt || !Number.isSafeInteger(amount) || amount === 0 || !description)
        throw new Error(`Dòng CSV ${index + 2} không hợp lệ.`);
      return { externalId, occurredAt, amount, reference, description };
    });
  }

  async importStatement() {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    this.message = '';
    try {
      const result = await firstValueFrom(this.http.post<any>(`${this.api}/bank-statements`, {
        requestKey: crypto.randomUUID(),
        accountId: this.form.accountId,
        statementKey: this.form.statementKey,
        from: this.form.from,
        to: this.form.to,
        openingBalance: Number(this.form.openingBalance),
        closingBalance: Number(this.form.closingBalance),
        currency: 'VND',
        evidence: this.form.evidence,
        lines: this.csvLines(),
      }));
      this.message = 'Đã nhập sao kê. Việc nhập không tự tạo thu/chi trong sổ.';
      await this.reload();
      await this.loadReport(String(result.statement._id));
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy = false;
    }
  }

  async loadReport(statementId: string) {
    this.busy = true;
    this.error = '';
    try {
      this.report = await firstValueFrom(
        this.http.get<any>(`${this.api}/bank-statements/${statementId}/reconciliation`),
      );
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy = false;
    }
  }

  async match(line: any, entry: any) {
    const evidence = window.prompt('Căn cứ ghép dòng ngân hàng với nghiệp vụ sổ:');
    if (!evidence?.trim()) return;
    this.busy = true;
    try {
      await firstValueFrom(this.http.post(`${this.api}/bank-statement-lines/${line._id}/match`, {
        entryId: entry.entryId,
        evidence,
      }));
      await this.loadReport(String(this.report.statement._id));
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy = false;
    }
  }

  async unmatch(line: any) {
    const evidence = window.prompt('Lý do bỏ ghép đối chiếu:');
    if (!evidence?.trim()) return;
    this.busy = true;
    try {
      await firstValueFrom(this.http.post(`${this.api}/bank-statement-lines/${line._id}/unmatch`, { evidence }));
      await this.loadReport(String(this.report.statement._id));
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy = false;
    }
  }
}

