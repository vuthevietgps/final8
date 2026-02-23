/**
 * File: features/labor-cost1/labor-cost1.model.ts
 * Mô tả: Định nghĩa kiểu dữ liệu cho Chi Phí Nhân Công 1.
 */
export interface LaborCost1 {
  _id?: string;
  date: string | Date; // ISO string hoặc Date
  userId: any; // string hoặc object đã populate { _id, fullName, ... }
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  workHours: number;
  sessionCount?: number;
  hourlyRate: number;
  cost: number;
  notes?: string;
  paid?: boolean;
  paidAt?: string;
  statementId?: string; // ID của phiếu thanh toán (nếu đã được thêm vào phiếu)
  paymentStatus?: 'unpaid' | 'in_statement' | 'paid';
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateLaborCost1Dto {
  date: string; // yyyy-MM-dd (FE sẽ chuyển từ dd/MM/yyyy sang)
  userId: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  notes?: string;
}

export interface UpdateLaborCost1Dto {
  date?: string; // yyyy-MM-dd
  userId?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
}

// ============================================
// LABOR STATEMENT MODELS
// ============================================

export interface LaborStatementPayment {
  amount: number;
  paidAt: string | Date;
  method?: string;
  reference?: string;
  notes?: string;
  createdBy?: string;
  documents?: string[];
}

export interface LaborStatement {
  _id?: string;
  employeeId: any; // string hoặc object đã populate
  periodFrom: string | Date;
  periodTo: string | Date;
  status: 'draft' | 'open' | 'closed';
  
  openingBalance: number;
  periodCost: number;
  totalWorkHours: number;
  sessionCount: number;
  
  // KPI & Bonus breakdown (mới)
  kpiPercent?: number; // % KPI do Director nhập
  attendanceBonus: number; // Thưởng chuyên cần
  kpiBonus: number; // Thưởng KPI
  punctualityBonus: number; // Thưởng đúng giờ (có thể âm)
  onTimeDays: number; // Số ngày đúng giờ
  lateDays: number; // Số ngày trễ
  kpiUpdatedBy?: string;
  kpiUpdatedAt?: string | Date;
  
  bonus: number;
  deduction: number;
  statementPaymentTotal: number;
  closingBalance: number;
  
  notes?: string;
  payments: LaborStatementPayment[];
  laborCostIds: string[];
  
  confirmedAt?: string | Date;
  confirmedBy?: string;
  closedAt?: string | Date;
  closedBy?: string;
  dueDate?: string | Date; // Ngày đến hạn thanh toán (CFO Spec v3.2)
  
  createdAt?: string;
  updatedAt?: string;
}

export interface LaborStatementDetail extends LaborStatement {
  laborCosts?: LaborCost1[]; // Chi tiết các phiên làm việc
}

export interface CreateLaborStatementDto {
  employeeId: string;
  periodFrom: string; // yyyy-MM-dd
  periodTo: string; // yyyy-MM-dd
  bonus?: number;
  deduction?: number;
  notes?: string;
}

export interface AddLaborPaymentDto {
  amount: number;
  paidAt: string; // yyyy-MM-dd
  method?: string;
  reference?: string;
  notes?: string;
  createdBy?: string;
  documents?: string[]; // Link chứng từ
}

export interface UpdateKpiDto {
  kpiPercent: number; // 0-100
  updatedBy?: string;
}

export interface LaborSummaryCards {
  unassigned: {
    amount: number;
    sessionCount: number;
  };
  inStatement: {
    amount: number;
    sessionCount: number;
  };
  paid: {
    amount: number;
    sessionCount: number;
  };
  overdue: {
    amount: number;
    statementCount: number;
  };
  due14d: {
    amount: number;
    statementCount: number;
  };
}
