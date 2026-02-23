"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const auth_service_1 = require("./auth/auth.service");
const user_enum_1 = require("./user/user.enum");
async function createDemoUsers() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const authService = app.get(auth_service_1.AuthService);
    try {
        await authService.register({
            email: 'director@example.com',
            password: '123456',
            fullName: 'Giám đốc Demo',
            role: user_enum_1.UserRole.DIRECTOR,
            phone: '0901234567',
            address: 'Hà Nội'
        });
        console.log('✅ Created Director user');
        await authService.register({
            email: 'manager@example.com',
            password: '123456',
            fullName: 'Quản lý Demo',
            role: user_enum_1.UserRole.MANAGER,
            phone: '0901234568',
            address: 'TP.HCM'
        });
        console.log('✅ Created Manager user');
        await authService.register({
            email: 'employee@example.com',
            password: '123456',
            fullName: 'Nhân viên Demo',
            role: user_enum_1.UserRole.EMPLOYEE,
            phone: '0901234569',
            address: 'Đà Nẵng'
        });
        console.log('✅ Created Employee user');
        console.log('\n🎉 Demo users created successfully!');
        console.log('Login credentials:');
        console.log('Director: director@example.com / 123456');
        console.log('Manager: manager@example.com / 123456');
        console.log('Employee: employee@example.com / 123456');
    }
    catch (error) {
        console.error('❌ Error creating demo users:', error.message);
    }
    await app.close();
}
createDemoUsers();
//# sourceMappingURL=create-demo-users.js.map