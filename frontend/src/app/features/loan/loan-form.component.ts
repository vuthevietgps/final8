import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { LoanService, CreateLoanContract } from './loan.service';
import { UserService } from '../user/user.service';
import { User, UserRole } from '../user/user.model';

@Component({
  selector: 'app-loan-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './loan-form.component.html',
  styleUrls: ['./loan-form.component.css']
})
export class LoanFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private loanService = inject(LoanService);
  private router = inject(Router);
  private userService = inject(UserService);

  form = this.fb.group({
    name: ['', Validators.required],
    lenderName: ['', Validators.required],
    principal: [0, [Validators.required, Validators.min(1)]],
    interestRate: [0, [Validators.min(0)]],
    repaymentCycle: [''],
    startDate: [''],
    endDate: [''],
    restricted: [false],
    status: ['active'],
    notes: ['']
  });

  loading = signal(false);
  error = signal<string | null>(null);
  lenders = signal<User[]>([]);

  ngOnInit(): void {
    this.loadLenders();
  }

  private loadLenders(): void {
    this.userService.getUsers(UserRole.LENDER, true).subscribe({
      next: users => this.lenders.set(users || []),
      error: err => {
        console.error(err);
        this.error.set('Không tải được danh sách người cho vay');
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = this.form.value as CreateLoanContract;
    this.loading.set(true);
    this.error.set(null);
    this.loanService.createLoan(payload).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/loans']);
      },
      error: (err) => {
        console.error(err);
        this.error.set('Không tạo được khoản vay');
        this.loading.set(false);
      }
    });
  }
}
