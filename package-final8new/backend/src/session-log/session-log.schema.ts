import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SessionLogDocument = SessionLog & Document;

@Schema({ timestamps: true })
export class SessionLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: string;

  @Prop()
  loginAt: Date;

  @Prop()
  logoutAt?: Date;

  @Prop()
  loginIp?: string;
}

export const SessionLogSchema = SchemaFactory.createForClass(SessionLog);
