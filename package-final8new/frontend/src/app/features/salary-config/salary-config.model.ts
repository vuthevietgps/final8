export interface SalaryConfig {
  _id?: string;
  userId: string | { _id: string; fullName: string; email?: string; role?: string };
  hourlyRate: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSalaryConfigDto {
  userId: string;
  hourlyRate: number;
  notes?: string;
}

export interface UpdateSalaryConfigDto {
  userId?: string;
  hourlyRate?: number;
  notes?: string;
}
