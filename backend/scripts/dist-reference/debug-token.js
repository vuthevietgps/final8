"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugTokens = debugTokens;
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const mongoose_1 = require("@nestjs/mongoose");
const fanpage_schema_1 = require("./fanpage/schemas/fanpage.schema");
async function debugTokens() {
    var _a, _b;
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    try {
        const fanpageModel = app.get((0, mongoose_1.getModelToken)(fanpage_schema_1.Fanpage.name));
        const fanpages = await fanpageModel.find().lean();
        console.log('=== FANPAGE ACCESS TOKENS DEBUG ===');
        for (const fp of fanpages) {
            console.log(`\nFanpage: ${fp.name}`);
            console.log(`PageID: ${fp.pageId}`);
            console.log(`Access Token: ${(_a = fp.accessToken) === null || _a === void 0 ? void 0 : _a.substring(0, 50)}...`);
            console.log(`Token length: ${((_b = fp.accessToken) === null || _b === void 0 ? void 0 : _b.length) || 0}`);
            console.log(`Status: ${fp.status}`);
            console.log(`AI Enabled: ${fp.aiEnabled}`);
            if (fp.accessToken) {
                try {
                    const response = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${encodeURIComponent(fp.accessToken)}`);
                    const result = await response.json();
                    if (result.error) {
                        console.log(`❌ Token Error: ${result.error.message} (Code: ${result.error.code})`);
                    }
                    else {
                        console.log(`✅ Token Valid: Page name from FB: ${result.name}`);
                    }
                }
                catch (error) {
                    console.log(`❌ Request Error: ${error.message}`);
                }
            }
        }
    }
    catch (error) {
        console.error('Debug error:', error);
    }
    finally {
        await app.close();
    }
}
if (require.main === module) {
    debugTokens().catch(console.error);
}
//# sourceMappingURL=debug-token.js.map