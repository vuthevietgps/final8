/**
 * FACEBOOK FANPAGE ACCESS TOKEN - THỜI GIAN SỐNG VÀ CÁCH LẤY TOKEN DÀI HẠN
 * Complete Guide to Facebook Page Access Token Lifecycle
 */

console.log(`
===================================================================
⏰ THỜI GIAN SỐNG CỦA FACEBOOK FANPAGE ACCESS TOKEN
===================================================================

📅 CÁC LOẠI TOKEN VÀ THỜI GIAN SỐNG:

1. 🕐 SHORT-LIVED USER ACCESS TOKEN (1-2 giờ)
   - Được tạo khi user đăng nhập Facebook lần đầu
   - Hết hạn sau 1-2 giờ
   - Dùng để exchange sang long-lived token

2. 🕕 LONG-LIVED USER ACCESS TOKEN (60 ngày)
   - Exchange từ short-lived token
   - Sống 60 ngày
   - Có thể refresh để gia hạn

3. 🕘 PAGE ACCESS TOKEN (KHÔNG HẾT HẠN)
   - Được tạo từ long-lived user token
   - KHÔNG HẾT HẠN nếu:
     ✅ User vẫn là admin của page
     ✅ App vẫn có quyền truy cập
     ✅ User không đổi mật khẩu Facebook
     ✅ User không bị khóa tài khoản

===================================================================

🎯 CÁCH LẤY PAGE ACCESS TOKEN DÀI HẠN (NEVER EXPIRES)
===================================================================

BƯỚC 1: LẤY SHORT-LIVED USER TOKEN
---------------------------------
Cách 1 - Graph API Explorer:
• Vào: https://developers.facebook.com/tools/explorer/
• Chọn App của bạn
• Chọn permissions: pages_manage_metadata, pages_show_list
• Generate Access Token (short-lived)

Cách 2 - Facebook Login SDK:
• Tích hợp Facebook Login vào app
• User đăng nhập và cấp quyền
• Nhận short-lived token từ response

BƯỚC 2: EXCHANGE SANG LONG-LIVED USER TOKEN
------------------------------------------
API Call:
GET https://graph.facebook.com/oauth/access_token
    ?grant_type=fb_exchange_token
    &client_id={YOUR_APP_ID}
    &client_secret={YOUR_APP_SECRET}
    &fb_exchange_token={SHORT_LIVED_TOKEN}

Response:
{
    "access_token": "LONG_LIVED_USER_TOKEN",
    "token_type": "bearer",
    "expires_in": 5183999  // ~60 days
}

BƯỚC 3: LẤY PAGE ACCESS TOKEN (NEVER EXPIRES)
--------------------------------------------
API Call:
GET https://graph.facebook.com/me/accounts
    ?access_token={LONG_LIVED_USER_TOKEN}

Response:
{
    "data": [
        {
            "access_token": "PAGE_ACCESS_TOKEN_NEVER_EXPIRES",
            "category": "Business",
            "name": "Your Page Name",
            "id": "PAGE_ID",
            "tasks": ["MANAGE", "CREATE_CONTENT", "MODERATE", "ADVERTISE", "ANALYZE"]
        }
    ]
}

===================================================================

🛠️ IMPLEMENTATION CODE EXAMPLES
===================================================================

JavaScript Implementation:
--------------------------
async function getLongLivedPageToken(shortLivedToken, appId, appSecret) {
    // Step 1: Exchange for long-lived user token
    const userTokenResponse = await fetch(\`https://graph.facebook.com/oauth/access_token?\` +
        \`grant_type=fb_exchange_token&\` +
        \`client_id=\${appId}&\` +
        \`client_secret=\${appSecret}&\` +
        \`fb_exchange_token=\${shortLivedToken}\`
    );
    
    const userTokenData = await userTokenResponse.json();
    const longLivedUserToken = userTokenData.access_token;
    
    // Step 2: Get page tokens
    const pageTokenResponse = await fetch(\`https://graph.facebook.com/me/accounts?\` +
        \`access_token=\${longLivedUserToken}\`
    );
    
    const pageTokenData = await pageTokenResponse.json();
    
    return pageTokenData.data; // Array of pages with never-expiring tokens
}

Node.js/NestJS Implementation:
-----------------------------
@Injectable()
export class FacebookTokenService {
    async exchangeForPageToken(shortLivedToken: string): Promise<PageToken[]> {
        // Exchange for long-lived user token
        const userTokenUrl = \`https://graph.facebook.com/oauth/access_token?\` +
            \`grant_type=fb_exchange_token&\` +
            \`client_id=\${process.env.FACEBOOK_APP_ID}&\` +
            \`client_secret=\${process.env.FACEBOOK_APP_SECRET}&\` +
            \`fb_exchange_token=\${shortLivedToken}\`;
            
        const userTokenResponse = await fetch(userTokenUrl);
        const userTokenData = await userTokenResponse.json();
        
        // Get page tokens
        const pageTokenUrl = \`https://graph.facebook.com/me/accounts?\` +
            \`access_token=\${userTokenData.access_token}\`;
            
        const pageTokenResponse = await fetch(pageTokenUrl);
        const pageTokenData = await pageTokenResponse.json();
        
        return pageTokenData.data;
    }
}

===================================================================

⚠️ CÁC TRƯỜNG HỢP TOKEN SẼ HẾT HẠN/INVALID
===================================================================

1. 👤 USER-RELATED ISSUES:
   • User bị remove khỏi page admin
   • User đổi mật khẩu Facebook
   • User bị khóa/vô hiệu hóa tài khoản
   • User revoke quyền truy cập của app

2. 🏢 PAGE-RELATED ISSUES:
   • Page bị unpublish/xóa
   • Page bị Facebook restrict
   • Page đổi category (hiếm)

3. 📱 APP-RELATED ISSUES:
   • App bị Facebook reject/suspend
   • App permissions bị revoke
   • App secret bị thay đổi

4. 🔒 SECURITY ISSUES:
   • Token bị leak/expose công khai
   • Suspicious activity detected
   • Rate limiting violations

===================================================================

🔄 CHIẾN LƯỢC QUẢN LÝ TOKEN DÀI HẠN
===================================================================

1. ✅ TOKEN HEALTH MONITORING:
   • Kiểm tra token định kỳ (mỗi 6-12 giờ)
   • Log all API calls và response codes
   • Set up alerts khi token fail

2. 🔁 AUTO-REFRESH MECHANISM:
   • Refresh long-lived user token trước khi hết hạn (7 ngày trước)
   • Re-generate page tokens từ refreshed user token
   • Update database with new tokens

3. 🛡️ BACKUP STRATEGY:
   • Store multiple valid tokens per page
   • Use different admin accounts as backup
   • Implement failover mechanism

4. 📢 NOTIFICATION SYSTEM:
   • Email alerts khi token sắp hết hạn
   • Dashboard warnings cho admins
   • Slack/Teams notifications

===================================================================

🎉 KẾT LUẬN VỀ PAGE ACCESS TOKEN
===================================================================

PAGE ACCESS TOKEN là loại token TỐT NHẤT cho Fanpage vì:

✅ KHÔNG HẾT HẠN (never expires)
✅ Có tất cả permissions cần thiết
✅ Stable và reliable cho production
✅ Có thể sử dụng cho webhook, posting, reading

🔑 ĐIỀU QUAN TRỌNG:
- Luôn lưu trữ PAGE ACCESS TOKEN, không phải User Token
- Monitor token health thường xuyên  
- Có backup plan khi token fail
- Implement proper error handling

Với strategy đúng, Page Access Token có thể hoạt động 
ổn định trong NHIỀU NĂM mà không cần can thiệp!

===================================================================
`);

// Detailed troubleshooting guide
console.log(`
🔍 TROUBLESHOOTING COMMON TOKEN ISSUES:

Issue: Token returns Error 190 (Invalid OAuth access token)
Solution: Token đã hết hạn hoặc invalid, cần tạo mới

Issue: Token returns Error 102 (API session limit)  
Solution: Giảm frequency của API calls, implement rate limiting

Issue: Permission denied errors
Solution: Kiểm tra lại permissions khi generate token

Issue: Token works in Graph Explorer but not in app
Solution: Đảm bảo sử dụng đúng App ID/Secret trong production

Issue: Token suddenly stops working
Solution: Check if user still admin of page, page still active

📞 SUPPORT RESOURCES:
- Facebook Developer Community: https://developers.facebook.com/community/
- Graph API Documentation: https://developers.facebook.com/docs/graph-api/
- Access Token Debugger: https://developers.facebook.com/tools/debug/accesstoken/
`);