export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  address?: string;
  isActive: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  address?: string;
}

export enum UserRole {
  DIRECTOR = 'director',
  MANAGER = 'manager', 
  EMPLOYEE = 'employee',
  INTERNAL_AGENT = 'internal_agent',
  EXTERNAL_AGENT = 'external_agent',
  INTERNAL_SUPPLIER = 'internal_supplier',
  EXTERNAL_SUPPLIER = 'external_supplier'
}
