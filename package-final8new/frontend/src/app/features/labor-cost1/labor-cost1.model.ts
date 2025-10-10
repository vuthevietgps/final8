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
  hourlyRate: number;
  cost: number;
  notes?: string;
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
