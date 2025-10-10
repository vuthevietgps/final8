# Vision AI + Product Database Integration

## Tổng quan

Hệ thống Vision AI tích hợp với Product Database cung cấp khả năng:
- 🔍 **Phân tích ảnh sản phẩm tự động** bằng OpenAI Vision API
- 🧠 **Tìm kiếm sản phẩm thông minh** dựa trên ngữ cảnh và từ khóa
- 💬 **Chatbot trả lời tự động** với gợi ý sản phẩm phù hợp
- 📸 **Quản lý ảnh đa dạng** với tối ưu hóa và variant tùy chỉnh

## Kiến trúc hệ thống

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User sends    │    │   Vision AI      │    │   Product       │
│   image/text    │───▶│   analyzes &     │───▶│   Database      │
│   via Messenger │    │   matches        │    │   returns recs  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │   AI Chatbot     │
                        │   responds with  │
                        │   recommendations│
                        └──────────────────┘
```

## API Endpoints

### 1. Upload và Phân tích ảnh
```
POST /products/upload-images
Content-Type: multipart/form-data

Body:
- images: File[] (max 10 files, 10MB each)
- fanpageId: string (optional)
- configId: string (optional - OpenAI config)

Response:
{
  "success": true,
  "message": "Đã tải lên và phân tích 3 ảnh",
  "data": {
    "images": [
      {
        "originalName": "phone.jpg",
        "filename": "uuid-generated.jpg",
        "url": "http://localhost:3000/uploads/products/uuid-generated.jpg",
        "size": 1024000,
        "mimetype": "image/jpeg",
        "optimized": {
          "thumbnail": "http://localhost:3000/uploads/products/uuid-generated_thumb.webp",
          "medium": "http://localhost:3000/uploads/products/uuid-generated_medium.webp",
          "large": "http://localhost:3000/uploads/products/uuid-generated_large.webp"
        },
        "aiAnalysis": {
          "objects": ["điện thoại", "iPhone", "smartphone"],
          "colors": ["đen", "bạc"],
          "features": ["camera kép", "màn hình lớn", "thiết kế cao cấp"],
          "keywords": ["iphone", "apple", "smartphone", "điện thoại"],
          "description": "iPhone màu đen với thiết kế cao cấp, camera kép chất lượng cao",
          "confidence": 0.92
        }
      }
    ],
    "totalAnalyzed": 3,
    "totalKeywords": 15
  }
}
```

### 2. Tìm sản phẩm tương tự
```
POST /products/find-similar

Body:
{
  "query": "điện thoại màu đen camera đẹp",
  "fanpageId": "fanpage_id_here",
  "limit": 5
}

Response:
{
  "success": true,
  "data": {
    "query": "điện thoại màu đen camera đẹp",
    "fanpageId": "fanpage_id_here",
    "recommendations": [
      {
        "product": {
          "_id": "product_id",
          "name": "iPhone 15 Pro Max",
          "importPrice": 25000000,
          "aiDescription": "iPhone 15 Pro Max màu đen titanium với camera 48MP",
          "images": [...],
          "searchKeywords": ["iphone", "apple", "camera", "đen"]
        },
        "matchScore": 15,
        "matchReasons": [
          "Khớp tên sản phẩm: \"điện thoại\"",
          "Khớp từ khóa: \"đen\"",
          "Khớp từ khóa: \"camera\""
        ]
      }
    ],
    "total": 3
  }
}
```

### 3. Phân tích ảnh từ URL
```
POST /products/analyze-image

Body:
{
  "imageUrl": "https://example.com/product-image.jpg",
  "configId": "openai_config_id" // optional
}

Response:
{
  "success": true,
  "data": {
    "imageUrl": "https://example.com/product-image.jpg",
    "analysis": {
      "objects": ["laptop", "macbook", "máy tính"],
      "colors": ["bạc", "xám"],
      "features": ["màn hình retina", "bàn phím magic", "touchpad lớn"],
      "keywords": ["macbook", "apple", "laptop", "máy tính"],
      "description": "MacBook Air màu bạc với thiết kế mỏng nhẹ",
      "confidence": 0.88
    }
  }
}
```

### 4. Thống kê AI Analysis
```
GET /products/ai-stats?fanpageId=fanpage_id

Response:
{
  "success": true,
  "data": {
    "totalProducts": 50,
    "productsWithAI": 35,
    "aiCoveragePercentage": 70,
    "totalImages": 120,
    "totalKeywords": 450,
    "avgConfidence": 0.85,
    "topKeywords": [
      { "keyword": "điện thoại", "count": 25 },
      { "keyword": "camera", "count": 20 },
      { "keyword": "đen", "count": 18 }
    ],
    "fanpageId": "fanpage_id"
  }
}
```

## Product Schema với AI Enhancement

```javascript
{
  name: "iPhone 15 Pro Max",
  categoryId: ObjectId("..."),
  importPrice: 25000000,
  shippingCost: 500000,
  packagingCost: 100000,
  
  // Enhanced AI fields
  images: [
    {
      url: "http://localhost:3000/uploads/products/image.jpg",
      description: "Ảnh chính sản phẩm",
      isMainImage: true,
      uploadedAt: Date,
      aiAnalysis: {
        objects: ["iPhone", "smartphone", "điện thoại"],
        colors: ["đen", "titan"],
        features: ["camera pro", "màn hình super retina"],
        keywords: ["iphone", "apple", "pro max", "camera"],
        confidence: 0.92
      }
    }
  ],
  
  searchKeywords: ["iphone", "apple", "smartphone", "camera", "đen", "pro"],
  aiDescription: "iPhone 15 Pro Max màu đen titanium với hệ thống camera Pro tiên tiến",
  
  fanpageVariations: [
    {
      fanpageId: ObjectId("..."),
      customName: "iPhone 15 Pro Max - Chính hãng VN/A",
      customDescription: "Mô tả tùy chỉnh cho fanpage cụ thể",
      customImages: ["http://example.com/custom-image.jpg"],
      priority: 5,
      isActive: true
    }
  ],
  
  status: "Hoạt động",
  estimatedDeliveryDays: 2,
  notes: "Sản phẩm HOT - Bán chạy",
  createdAt: Date,
  updatedAt: Date
}
```

## Messenger Webhook Integration

### Smart Product Matching trong Chat

Khi user gửi tin nhắn có ý định mua sản phẩm:

1. **Phát hiện ý định**: Hệ thống tự động phát hiện từ khóa sản phẩm
2. **Tìm kiếm thông minh**: Sử dụng Vision AI để match sản phẩm
3. **Tạo response**: AI tạo câu trả lời với gợi ý sản phẩm phù hợp
4. **Gửi tin nhắn**: Tự động trả lời qua Messenger API

### Example Conversation:

**User**: "Cho mình xem điện thoại màu đen camera đẹp"

**AI Response**: "Chào bạn! Mình có một số mẫu điện thoại màu đen camera đẹp như sau:

📱 iPhone 15 Pro Max - 25.000.000đ 
   Camera 48MP siêu sắc nét, thiết kế titanium cao cấp

📱 Samsung Galaxy S24 Ultra - 22.000.000đ
   Camera zoom 100x, S Pen tích hợp tiện lợi

📱 Xiaomi 14 Ultra - 18.000.000đ
   Camera Leica partnership, chụp ảnh chuyên nghiệp

Bạn quan tâm mẫu nào để mình tư vấn chi tiết hơn? 😊"

## File Upload & Optimization

### Supported Formats
- **Input**: JPEG, PNG, WebP, GIF
- **Max size**: 10MB per file, 10 files per upload
- **Output**: Optimized WebP với 3 sizes:
  - Thumbnail: 150x150px, 80% quality
  - Medium: 400x400px, 85% quality  
  - Large: 800x800px, 90% quality

### Storage Structure
```
uploads/products/
├── original-uuid.jpg          # Original uploaded file
├── original-uuid_thumb.webp   # Thumbnail version
├── original-uuid_medium.webp  # Medium version
├── original-uuid_large.webp   # Large version
└── original-uuid_fp_fanpage1.webp # Fanpage variant
```

## Configuration

### Environment Variables
```env
# OpenAI Vision API
OPENAI_API_KEY=your_openai_api_key_here

# File Upload
BASE_URL=http://localhost:3000
UPLOAD_PATH=./uploads/products
MAX_FILE_SIZE=10485760  # 10MB

# Messenger Integration
FB_GRAPH_VERSION=v23.0
CHAT_WEBHOOK_DEBUG=1  # Enable debug logs
```

### MongoDB Collections

#### Products Collection
- Enhanced với AI analysis fields
- Search keywords indexing
- Fanpage variations support

#### OpenAI Configs Collection  
- Multiple API keys management
- Model configurations
- Usage tracking

## Usage Examples

### 1. Basic Product Upload với AI Analysis

```javascript
const formData = new FormData();
formData.append('images', file1);
formData.append('images', file2);
formData.append('fanpageId', 'your_fanpage_id');

const response = await fetch('/products/upload-images', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log('AI Analysis:', result.data.images[0].aiAnalysis);
```

### 2. Smart Product Search

```javascript
const searchResults = await fetch('/products/find-similar', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'laptop gaming RTX 4080',
    fanpageId: 'fanpage_id',
    limit: 3
  })
});

const recommendations = await searchResults.json();
recommendations.data.recommendations.forEach(rec => {
  console.log(`${rec.product.name} - Score: ${rec.matchScore}`);
  console.log(`Reasons: ${rec.matchReasons.join(', ')}`);
});
```

## Performance Considerations

### 1. Image Processing
- ✅ Asynchronous processing để không block API
- ✅ Lazy loading cho ảnh lớn
- ✅ CDN ready với static URL structure
- ✅ Automatic cleanup cho failed uploads

### 2. AI API Optimization
- ✅ Fallback response khi API fails
- ✅ Confidence score filtering
- ✅ Rate limiting protection
- ✅ Cost optimization với smart prompting

### 3. Database Performance
- ✅ Text indexes trên searchKeywords
- ✅ Compound indexes cho fanpage queries
- ✅ Aggregation pipelines cho stats
- ✅ Lean queries để optimize memory

## Troubleshooting

### Common Issues

1. **OpenAI API Errors**
   - Check API key validity
   - Monitor rate limits
   - Verify image URL accessibility

2. **File Upload Failures**
   - Check file size limits
   - Ensure upload directory permissions
   - Verify supported file formats

3. **Product Matching Issues**
   - Review search keywords quality
   - Check AI analysis confidence scores
   - Verify fanpage associations

### Debug Mode

Enable debug logging:
```env
CHAT_WEBHOOK_DEBUG=1
```

Logs will show:
- Product recommendation counts
- AI analysis confidence scores
- Message processing details
- API call success/failure

## Security Considerations

### 1. File Upload Security
- ✅ File type validation
- ✅ Size limits enforcement  
- ✅ Malicious file detection
- ✅ Secure filename generation

### 2. API Security
- ✅ Input validation on all endpoints
- ✅ Rate limiting on AI endpoints
- ✅ Authentication for sensitive operations
- ✅ Sanitized error responses

### 3. Data Privacy
- ✅ User data anonymization in logs
- ✅ Secure API key storage
- ✅ GDPR compliance ready
- ✅ Audit trail for AI decisions

---

**Phát triển bởi**: Vision AI Team  
**Phiên bản**: 1.0.0  
**Cập nhật**: December 2024