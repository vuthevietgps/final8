import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from './user.enum';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  private parseActiveQuery(active?: string): boolean | undefined {
    if (active === 'true') return true;
    if (active === 'false') return false;
    return undefined;
  }

  @Post()
  @RequirePermissions('users')
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  @RequirePermissions('users')
  findAll(@Query('role') role?: string, @Query('active') active?: string) {
    if (role) {
      return this.userService.findByRole(role);
    }
    if (active === 'true') {
      return this.userService.findActiveUsers();
    }
    return this.userService.findAll();
  }

  @Get('agents')
  @RequirePermissions('orders-test2')
  getAgents(@Query('active') active?: string) {
    return this.userService.findAgentsMinimal({
      roles: [UserRole.INTERNAL_AGENT, UserRole.EXTERNAL_AGENT],
      active: this.parseActiveQuery(active),
    });
  }

  @Get('agents-for-ads')
  @RequirePermissions('ad-groups')
  getAgentsForAds(@Query('active') active?: string) {
    return this.userService.findAgentsMinimal({
      roles: [UserRole.INTERNAL_AGENT, UserRole.EXTERNAL_AGENT],
      active: this.parseActiveQuery(active),
    });
  }

  @Get('ads-operators')
  @RequirePermissions('ad-accounts')
  getActiveAdsOperators() {
    return this.userService.findActiveAdsOperatorsMinimal([
      UserRole.DIRECTOR,
      UserRole.MANAGER,
      UserRole.EMPLOYEE,
    ]);
  }

  @Get('suppliers-for-orders')
  @RequirePermissions('orders-test2')
  getSuppliersForOrders(@Query('active') active?: string) {
    return this.userService.findSuppliersMinimal({
      roles: [UserRole.INTERNAL_SUPPLIER, UserRole.EXTERNAL_SUPPLIER],
      active: this.parseActiveQuery(active),
    });
  }

  @Get('suppliers')
  @RequirePermissions('users')
  getSuppliers(
    @Query('q') q?: string,
    @Query('active') active?: string,
    @Query('minimal') minimal?: string,
  ) {
    const activeBool = active === 'true' ? true : active === 'false' ? false : undefined;
    const minimalBool = minimal === 'true';
    return this.userService.findSuppliers({ q, active: activeBool, minimal: minimalBool });
  }

  @Get('email/:email')
  @RequirePermissions('users')
  findByEmail(@Param('email') email: string) {
    return this.userService.findByEmail(email);
  }

  @Get(':id')
  @RequirePermissions('users')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('users')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  @RequirePermissions('users')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
