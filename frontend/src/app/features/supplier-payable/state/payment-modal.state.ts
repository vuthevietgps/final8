import { Injectable, signal } from '@angular/core';
import { SupplierStatement } from '../supplier-payable.service';

/**
 * State management for payment modal
 */
@Injectable()
export class PaymentModalState {
  readonly isOpen = signal(false);
  readonly selectedStatement = signal<SupplierStatement | null>(null);
  readonly form = signal({
    amount: 0,
    paidAt: new Date().toISOString().split('T')[0],
    method: 'Bank Transfer',
    reference: '',
    notes: ''
  });
  readonly files = signal<{ name: string; size: number }[]>([]);

  open(statement: SupplierStatement) {
    this.selectedStatement.set(statement);
    this.form.set({
      amount: 0,
      paidAt: new Date().toISOString().split('T')[0],
      method: 'Bank Transfer',
      reference: '',
      notes: ''
    });
    this.files.set([]);
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
    this.selectedStatement.set(null);
  }

  addFiles(newFiles: File[]) {
    const current = this.files();
    const toAdd = newFiles.slice(0, 5 - current.length);
    const fileInfos = toAdd.map(f => ({ name: f.name, size: f.size }));
    this.files.set([...current, ...fileInfos]);
  }

  removeFile(index: number) {
    const current = this.files();
    this.files.set(current.filter((_, i) => i !== index));
  }

  updateForm(updates: Partial<typeof this.form>) {
    this.form.update(current => ({ ...current, ...updates }));
  }
}
