"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const path_1 = require("path");
const fs_1 = require("fs");
const crypto_1 = require("crypto");
const product_service_1 = require("./product.service");
const product_controller_1 = require("./product.controller");
const vision_ai_service_1 = require("./vision-ai.service");
const file_upload_service_1 = require("./file-upload.service");
const product_schema_1 = require("./schemas/product.schema");
const openai_config_module_1 = require("../openai-config/openai-config.module");
const media_schema_1 = require("../media/schemas/media.schema");
const uploadPath = (0, path_1.join)(process.cwd(), 'uploads', 'products');
if (!(0, fs_1.existsSync)(uploadPath)) {
    (0, fs_1.mkdirSync)(uploadPath, { recursive: true });
}
let ProductModule = class ProductModule {
};
exports.ProductModule = ProductModule;
exports.ProductModule = ProductModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: product_schema_1.Product.name, schema: product_schema_1.ProductSchema },
                { name: media_schema_1.Media.name, schema: media_schema_1.MediaSchema }
            ]),
            platform_express_1.MulterModule.register({
                storage: (0, multer_1.diskStorage)({
                    destination: uploadPath,
                    filename: (req, file, cb) => {
                        const uniqueName = `${(0, crypto_1.randomUUID)()}${(0, path_1.extname)(file.originalname)}`;
                        cb(null, uniqueName);
                    },
                }),
                fileFilter: (req, file, cb) => {
                    const allowedMimeTypes = [
                        'image/jpeg',
                        'image/png',
                        'image/webp',
                        'image/gif'
                    ];
                    if (allowedMimeTypes.includes(file.mimetype)) {
                        cb(null, true);
                    }
                    else {
                        cb(new Error(`Định dạng file không được hỗ trợ. Chỉ chấp nhận: ${allowedMimeTypes.join(', ')}`), false);
                    }
                },
                limits: {
                    fileSize: 10 * 1024 * 1024,
                    files: 10
                },
            }),
            openai_config_module_1.OpenAIConfigModule
        ],
        controllers: [product_controller_1.ProductController],
        providers: [product_service_1.ProductService, vision_ai_service_1.VisionAIService, file_upload_service_1.FileUploadService],
        exports: [product_service_1.ProductService, vision_ai_service_1.VisionAIService]
    })
], ProductModule);
//# sourceMappingURL=product.module.js.map