import { IsIn, IsInt, IsString, Length, Matches, Min, ValidateIf } from 'class-validator';

export class SaveDebtScheduleDto {
  @IsString() @Length(8, 160) requestKey!: string;
  @IsString() @Matches(/^(supplier|agent):[a-f0-9]{24}$/i) partyKey!: string;
  @IsString() @Length(1, 200) orderId!: string;
  @IsIn(['receivable', 'payable']) direction!: 'receivable' | 'payable';
  @IsInt() @Min(0) expectedRevision!: number;
  @IsString() @Matches(/^[a-f0-9]{64}$/) sourceHash!: string;
  @ValidateIf((_o, v) => v !== null) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) dueDate!: string | null;
  @ValidateIf((_o, v) => v !== null) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) promisedDate!: string | null;
  @IsString() @Length(1, 2000) evidence!: string;
  @IsString() @Length(1, 1000) reason!: string;
}
