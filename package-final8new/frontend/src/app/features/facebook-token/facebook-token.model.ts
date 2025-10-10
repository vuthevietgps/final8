export interface FacebookToken {
  _id: string;
  name: string;
  description?: string;
  permissions: string[];
  expiresAt?: Date;
  isActive: boolean;
  isDefault: boolean;
  usage: {
    count: number;
    lastUsed?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}