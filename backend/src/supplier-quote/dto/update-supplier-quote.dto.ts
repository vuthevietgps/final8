import { PartialType } from '@nestjs/mapped-types';
import { CreateSupplierQuoteDto } from './create-supplier-quote.dto';

// Approval fields are deliberately absent. Editing quote data can never set or
// preserve an approved decision when the price changes.
export class UpdateSupplierQuoteDto extends PartialType(CreateSupplierQuoteDto) {}
