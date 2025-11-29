"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fixToken = fixToken;
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const fanpage_service_1 = require("./fanpage/fanpage.service");
async function fixToken() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    try {
        const fanpageService = app.get(fanpage_service_1.FanpageService);
        const fanpageId = '68ebcb48b631002b38117c82';
        console.log('🔍 Checking current token status...');
        const validation = await fanpageService.validateAccessToken(fanpageId);
        if (validation.valid) {
            console.log('✅ Current token is valid!');
            console.log('Page Info:', validation.pageInfo);
        }
        else {
            console.log('❌ Current token is invalid:', validation.error);
            console.log('');
            console.log('📋 To fix this issue:');
            console.log('1. Go to Facebook Developer Console');
            console.log('2. Navigate to your app');
            console.log('3. Go to Tools & Support > Access Token Tool');
            console.log('4. Generate a new Page Access Token for page ID: 670008282852091');
            console.log('5. Copy the new token');
            console.log('6. Update via API or directly in database');
            console.log('');
            console.log('🔧 API Endpoint to update:');
            console.log(`POST /api/fanpages/${fanpageId}/refresh-token`);
            console.log('Body: { "accessToken": "NEW_TOKEN_HERE" }');
        }
    }
    catch (error) {
        console.error('❌ Error:', error.message);
    }
    finally {
        await app.close();
    }
}
if (require.main === module) {
    fixToken().catch(console.error);
}
//# sourceMappingURL=fix-token.js.map