import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../../user/user.schema';

@Schema({ timestamps: true })
export class SalaryConfig {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, unique: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  hourlyRate: number;

  @Prop({ type: String })
  notes?: string;
}

export type SalaryConfigDocument = HydratedDocument<SalaryConfig>;
export const SalaryConfigSchema = SchemaFactory.createForClass(SalaryConfig);
