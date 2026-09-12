import {Prop,Schema,SchemaFactory} from '@nestjs/mongoose';
import {Schema as MongoSchema} from 'mongoose';
@Schema({timestamps:true,collection:'businessledgersettlements'})
export class LedgerSettlement {
  @Prop({required:true,unique:true,immutable:true}) requestKey!:string;
  @Prop({required:true,immutable:true}) requestHash!:string;
  @Prop({required:true,index:true,immutable:true}) partyKey!:string;
  @Prop({required:true,immutable:true}) sourceHash!:string;
  @Prop({type:[MongoSchema.Types.Mixed],required:true,immutable:true}) rows!:any[];
  @Prop({required:true,immutable:true}) evidence!:string;
  @Prop({required:true,immutable:true}) createdBy!:string;
  @Prop({default:'draft',enum:['draft','confirmed']}) status!:string;
  @Prop() confirmedBy?:string;
  @Prop() confirmedAt?:Date;
  @Prop() confirmationEvidence?:string;
  @Prop({type:[MongoSchema.Types.Mixed],default:[]}) operations!:any[];
}
export const LedgerSettlementSchema=SchemaFactory.createForClass(LedgerSettlement);
