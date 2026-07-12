import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { UserService } from './src/user/user.service';
import { UserRole } from './src/user/user.enum';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userService = app.get(UserService);

  const adminEmail = 'admin@example.com';
  let user = await userService.findByEmail(adminEmail);

  if (!user) {
    user = await userService.create({
      email: adminEmail,
      password: '123456',
      fullName: 'System Admin',
      role: UserRole.DIRECTOR,
      phone: '0900000000',
      isActive: true,
      allowedLoginIps: []
    } as any);
    console.log(`Created admin user: ${adminEmail} (ID: ${user._id})`);
  } else {
    console.log(`User already exists: ${adminEmail} (Role: ${user.role})`);
    
    // Ensure password is correct and Active
    user = await userService.update(user._id.toString(), {
      password: '123456', // The auth service will hash this on next login if it's plaintext, or we could pass plain if the service hashes it on update
      isActive: true,
      role: UserRole.DIRECTOR
    });
    console.log(`Updated admin user constraints.`);
  }

  await app.close();
  process.exit(0);
}

bootstrap().catch(err => {
  console.error(err);
  process.exit(1);
});
