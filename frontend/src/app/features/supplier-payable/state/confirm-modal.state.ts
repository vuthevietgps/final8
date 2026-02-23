import { Injectable, signal } from '@angular/core';
import { SupplierStatement } from '../supplier-payable.service';

/**
 * State management for close statement confirmation modal
 */
@Injectable()
export class ConfirmModalState {
  readonly isOpen = signal(false);
  readonly selectedStatement = signal<SupplierStatement | null>(null);

  open(statement: SupplierStatement) {
    this.selectedStatement.set(statement);
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
    this.selectedStatement.set(null);
  }
}
