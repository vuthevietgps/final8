import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';
import { UserRole } from './user/user.enum';

async function createDemoUsers() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const authService = app.get(AuthService);

  try {
    // Create Director
    await authService.register({
      email: 'director@example.com',
      password: '123456',
      fullName: 'Giám đốc Demo',
      role: UserRole.DIRECTOR,
      phone: '0901234567',
      address: 'Hà Nội'
    });
    console.log('✅ Created Director user');

    // Create Manager  
    await authService.register({
      email: 'manager@example.com',
      password: '123456',
      fullName: 'Quản lý Demo',
      role: UserRole.MANAGER,
      phone: '0901234568',
      address: 'TP.HCM'
    });
    console.log('✅ Created Manager user');

    // Create Employee
    await authService.register({
      email: 'employee@example.com',
      password: '123456',
      fullName: 'Nhân viên Demo',
      role: UserRole.EMPLOYEE,
      phone: '0901234569',
      address: 'Đà Nẵng'
    });
    console.log('✅ Created Employee user');

    console.log('\n🎉 Demo users created successfully!');
    console.log('Login credentials:');
    console.log('Director: director@example.com / 123456');
    console.log('Manager: manager@example.com / 123456');
    console.log('Employee: employee@example.com / 123456');

  } catch (error) {
    console.error('❌ Error creating demo users:', error.message);
  }

  await app.close();
}

createDemoUsers();
