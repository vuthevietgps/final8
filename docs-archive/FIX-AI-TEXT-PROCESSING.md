# Fix AI Response Text Processing Bug

## 🐛 Vấn đề được phát hiện

AI chatbot trả lời bằng các ký tự lạ như `!`, `.`, `,` thay vì văn bản bình thường.

## 🔍 Nguyên nhân 

Regex sanitization quá aggressive, xóa luôn ký tự tiếng Việt:

### Code lỗi:
```javascript
// ❌ Regex này xóa quá nhiều Unicode ranges bao gồm tiếng Việt
const sanitized = message.replace(/[\u2190-\u21FF\u2300-\u27BF\u2600-\u27BF\u2B00-\u2BFF\u1F000-\u1FFFF\uFE0F\u200D]/g, '');
```

Ví dụ: "Xin chào!" → "!" (xóa hết chữ, chỉ còn dấu chấm than)

### Code đã fix:
```javascript
// ✅ Chỉ xóa emoji thực sự, giữ nguyên tiếng Việt
const sanitized = message.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}\u{200D}]/gu, '');
```

## 🔧 Files đã sửa

1. **messenger-webhook.service.ts** (2 vị trí):
   - `generateAiResponse()` - function sanitize()
   - `sendFacebookMessage()` - sanitized variable

## 🧪 Test kết quả

```
Input:  "Xin chào! Shop có hỗ trợ sản phẩm gì không ạ?"
Before: "!"
After:  "Xin chào! Shop có hỗ trợ sản phẩm gì không ạ?" ✅

Input:  "🔥 Sản phẩm hot! 🚀 Giao hàng nhanh!"  
Before: "🔥 ! 🚀 !"
After:  "Sản phẩm hot! Giao hàng nhanh!" ✅
```

## 🚀 Deployment

```bash
# Build và restart backend
cd backend
npm run build
docker restart htxbachgia-shop-backend

# Hoặc deploy full image
docker build -t vutheviet/final8new:backend-fixed .
docker push vutheviet/final8new:backend-fixed
```

## ✅ Kết quả mong đợi

Sau khi deploy:
- AI sẽ trả lời văn bản tiếng Việt bình thường  
- Emoji sẽ được loại bỏ (professional tone)
- Không còn tin nhắn toàn dấu câu như "!", ".", ","