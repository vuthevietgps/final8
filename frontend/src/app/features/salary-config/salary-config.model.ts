/**
 * Bậc thưởng chuyên cần theo tổng giờ làm việc
 */
export interface AttendanceTier {
  minHours: number;
  maxHours: number;
  bonusAmount: number;
}

/**
 * Bậc thưởng theo % hoàn thành KPI
 */
export interface KpiBonusTier {
  minPercent: number;
  maxPercent: number;
  bonusAmount: number;
}

/**
 * Quy tắc thưởng/phạt chấm công đúng giờ
 */
export interface PunctualityRules {
  checkInDeadline: string; // HH:mm format
  onTimeBonus: number;
  latePenalty: number;
  gracePeriodMinutes: number;
}

export interface SalaryConfig {
  _id?: string;
  userId: string | { _id: string; fullName: string; email?: string; role?: string };
  payrollCycle: 'weekly' | 'monthly';
  paymentDays: number[]; // Ngày thanh toán lương trong tháng, VD: [5] hoặc [5, 20]
  hourlyRate: number;
  attendanceTiers: AttendanceTier[];
  kpiBonusTiers: KpiBonusTier[];
  punctualityRules: PunctualityRules | null;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSalaryConfigDto {
  userId: string;
  payrollCycle?: 'weekly' | 'monthly';
  paymentDays?: number[];
  hourlyRate: number;
  attendanceTiers?: AttendanceTier[];
  kpiBonusTiers?: KpiBonusTier[];
  punctualityRules?: PunctualityRules;
  notes?: string;
}

export interface UpdateSalaryConfigDto {
  userId?: string;
  payrollCycle?: 'weekly' | 'monthly';
  paymentDays?: number[];
  hourlyRate?: number;
  attendanceTiers?: AttendanceTier[];
  kpiBonusTiers?: KpiBonusTier[];
  punctualityRules?: PunctualityRules | null;
  notes?: string;
}
