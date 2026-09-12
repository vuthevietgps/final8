import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import {
  ENTRY_KINDS,
  EntryKind,
  PARTIES,
  Party,
} from "./business-ledger.rules";

export class CreateLedgerAccountDto {
  @Matches(/^[a-z0-9_-]{1,40}$/) code!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsInt() @Min(0) @Max(1_000_000_000_000) openingBalance!: number;
  @IsDateString() openingAt!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) evidence!: string;
}
export class CreateLedgerProfileDto {
  @IsMongoId() orderId!: string;
  @IsIn(["retail", "dealer"]) saleMode!: "retail" | "dealer";
  @IsIn(["recoverable", "production_committed"]) returnPolicy!: "recoverable" | "production_committed";
  @IsIn(["supplier_direct", "inventory"]) fulfillment!:
    | "supplier_direct"
    | "inventory";
  @IsString() @IsNotEmpty() @MaxLength(500) evidence!: string;
}
export class CreateLedgerEntryDto {
  @IsString() @IsNotEmpty() @MaxLength(120) idempotencyKey!: string;
  @IsIn(ENTRY_KINDS) kind!: EntryKind;
  @IsInt() @Min(0) @Max(1_000_000_000_000) amount!: number;
  @IsDateString() occurredAt!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) evidence!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) description!: string;
  @IsOptional() @IsMongoId() orderId?: string;
  @IsOptional() @IsMongoId() purchaseOrderId?: string;
  @IsOptional() @IsMongoId() reversalOf?: string;
  @IsOptional() @IsIn(PARTIES) fromParty?: Party;
  @IsOptional() @IsIn(PARTIES) toParty?: Party;
  @IsOptional() @IsIn(PARTIES) expenseParty?: Party;
  @IsOptional() @Matches(/^[\p{L}\p{N} _.-]{1,100}$/u) otherParty?: string;
  @IsOptional() @IsMongoId() fromAccountId?: string;
  @IsOptional() @IsMongoId() toAccountId?: string;
  @IsOptional() @IsBoolean() settlesDebt?: boolean;
}
export class RejectLedgerEntryDto {
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
}
export class LedgerReportQuery {
  @IsDateString() from!: string;
  @IsDateString() to!: string;
}
