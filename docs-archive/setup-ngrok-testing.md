# Setup Ngrok cho Facebook Webhook Testing

## Bước 1: Install Ngrok
```bash
# Download ngrok từ https://ngrok.com/download
# Hoặc dùng npm
npm install -g ngrok
```

## Bước 2: Expose Local Backend
```bash
# Trong terminal mới
ngrok http 3000

# Output sẽ có URL như: https://abc123.ngrok.io
```

## Bước 3: Update Facebook Webhook URL
1. Vào Facebook Developer Console
2. Chọn app của bạn
3. Messenger > Settings
4. Cập nhật Webhook URL: `https://abc123.ngrok.io/api/webhook/messenger`
5. Verify token: `dev-verify-token` (hoặc value trong .env)

## Bước 4: Test với Token Thật
```typescript
// Tạo endpoint test trong backend
@Post('debug/test-token/:fanpageId')
async testToken(@Param('fanpageId') fanpageId: string) {
  const fanpage = await this.fanpageModel.findById(fanpageId).lean();
  
  // Test với Graph API
  const response = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${fanpage.accessToken}`);
  const result = await response.json();
  
  return { fanpage: fanpage.name, valid: !result.error, result };
}
```

## Bước 5: Update Access Token
```bash
# API để cập nhật token mới
curl -X POST https://abc123.ngrok.io/api/fanpages/68ebcb48b631002b38117c82/refresh-token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{"accessToken": "NEW_FACEBOOK_PAGE_TOKEN"}'
```

## Lưu ý
- Ngrok URL thay đổi mỗi lần restart (trừ khi dùng paid plan)
- Phải cập nhật webhook URL mỗi lần thay đổi
- Access token phải lấy từ Facebook Developer Console