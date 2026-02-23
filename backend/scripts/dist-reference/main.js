"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const path_1 = require("path");
const fs = require("fs");
const nodeCrypto = require("crypto");
try {
    const g = global;
    const desc = Object.getOwnPropertyDescriptor(g, 'crypto');
    if (!g.crypto) {
        Object.defineProperty(g, 'crypto', {
            value: nodeCrypto,
            writable: false,
            configurable: true,
            enumerable: false,
        });
    }
    else if (desc && desc.writable) {
        g.crypto = g.crypto || nodeCrypto;
    }
}
catch (_a) {
}
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api', {
        exclude: [{ path: 'health', method: common_1.RequestMethod.ALL }],
    });
    app.useStaticAssets((0, path_1.join)(__dirname, '..', 'uploads'), {
        prefix: '/uploads/',
    });
    const base = process.env.MEDIA_PUBLIC_BASE || '/media';
    const mediaPrefix = base.endsWith('/') ? base : base + '/';
    const mediaCandidates = [
        process.env.MEDIA_DIR,
        (0, path_1.join)(process.cwd(), '..', 'media'),
        (0, path_1.join)(process.cwd(), '..', 'uploads', 'media'),
        (0, path_1.join)(process.cwd(), 'uploads', 'media'),
    ].filter(Boolean);
    const mounted = [];
    for (const dir of mediaCandidates) {
        try {
            if (fs.existsSync(dir)) {
                app.useStaticAssets(dir, { prefix: mediaPrefix });
                mounted.push(dir);
            }
        }
        catch (_a) { }
    }
    if (mounted.length === 0) {
        const fallback = (0, path_1.join)(process.cwd(), 'uploads', 'media');
        try {
            fs.mkdirSync(fallback, { recursive: true });
        }
        catch (_b) { }
        app.useStaticAssets(fallback, { prefix: mediaPrefix });
        mounted.push(fallback);
    }
    console.log('[media] static mounts:', { prefix: mediaPrefix, mounted });
    app.enableCors({
        origin: [
            'http://localhost:4200',
            'http://localhost:4201',
            'http://localhost:8080'
        ],
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
    });
    app.use((req, res, next) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        next();
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
            enableImplicitConversion: true,
        },
    }));
    const port = parseInt(process.env.PORT || '3000', 10);
    await app.listen(port);
    console.log(`Backend server is running on http://localhost:${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map