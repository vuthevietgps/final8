import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { SupplierPayableController } from './supplier-payable.controller';
import { SupplierPayableService } from './supplier-payable.service';
import { StatementPdfGenerator } from './generators/statement-pdf.generator';
import { StatementManagementService } from './services/statement-management.service';
import { CsvExportService } from './services/csv-export.service';
import { OrderIntegrationService } from './services/order-integration.service';
import { SupplierPayable, SupplierPayableSchema } from './schemas/supplier-payable.schema';
import { SupplierStatement, SupplierStatementSchema } from './schemas/supplier-statement.schema';
import { TestOrder2, TestOrder2Schema } from '../test-order2/schemas/test-order2.schema';
import { User, UserSchema } from '../user/user.schema';
import { RolesGuard } from './guards/roles.guard';
import { Reflector } from '@nestjs/core';
import { SystemSettings, SystemSettingsSchema } from '../finance/schemas/system-settings.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SupplierPayable.name, schema: SupplierPayableSchema },
      { name: SupplierStatement.name, schema: SupplierStatementSchema },
      { name: TestOrder2.name, schema: TestOrder2Schema },
      { name: User.name, schema: UserSchema },
      // Canonical owner of SupplierCashCycleDays; no supplier-local policy copy.
      { name: SystemSettings.name, schema: SystemSettingsSchema },
    ]),
    // Use same JWT config as AuthModule to ensure token compatibility
    JwtModule.register({
      // Note: In production, JWT_SECRET must be set via environment
      secret: process.env.JWT_SECRET || 'dev-only-insecure-secret-do-not-use-in-production',
      signOptions: { expiresIn: '4h' },
    }),
  ],
  controllers: [SupplierPayableController],
  providers: [
    SupplierPayableService,
    StatementPdfGenerator,
    StatementManagementService,
    CsvExportService,
    OrderIntegrationService,
    RolesGuard,
    Reflector,
  ],
  exports: [SupplierPayableService],
})
export class SupplierPayableModule {}
