/**
 * Script kiểm tra các messaging metrics có sẵn từ Facebook Ads API
 */

async function checkMessagingMetrics() {
  console.log('=== FACEBOOK ADS MESSAGING METRICS ===\n');

  console.log('📱 Messaging Metrics có sẵn từ Facebook:');
  
  const messagingMetrics = {
    // Conversation metrics
    'messaging_conversation_started_7d': {
      name: 'Số lượt bắt đầu cuộc trò chuyện qua tin nhắn (7 ngày)',
      description: 'Số cuộc trò chuyện được bắt đầu từ quảng cáo trong 7 ngày'
    },
    'cost_per_messaging_conversation_started_7d': {
      name: 'Chi phí trên mỗi lượt bắt đầu cuộc trò chuyện qua tin nhắn',
      description: 'Chi phí trung bình cho mỗi cuộc trò chuyện được bắt đầu (7 ngày)',
      formula: 'spend / messaging_conversation_started_7d'
    },
    'messaging_conversation_started_7d_unique': {
      name: 'Số lượt bắt đầu cuộc trò chuyện qua tin nhắn duy nhất (7 ngày)', 
      description: 'Số người duy nhất bắt đầu cuộc trò chuyện từ quảng cáo trong 7 ngày'
    },
    'messaging_first_reply': {
      name: 'Lượt phản hồi tin nhắn đầu tiên',
      description: 'Số lần doanh nghiệp phản hồi tin nhắn đầu tiên từ khách hàng'
    },
    'messaging_purchase_conversion_value_7d': {
      name: 'Giá trị chuyển đổi mua hàng qua tin nhắn (7 ngày)',
      description: 'Tổng giá trị mua hàng từ các cuộc trò chuyện trong 7 ngày'
    }
  };

  Object.entries(messagingMetrics).forEach(([field, info]) => {
    console.log(`\n🔸 ${field}`);
    console.log(`   Tên: ${info.name}`);
    console.log(`   Mô tả: ${info.description}`);
    if (info.formula) {
      console.log(`   Công thức: ${info.formula}`);
    }
  });

  console.log('\n🎯 Trả lời câu hỏi:');
  console.log('❓ "Chi phí trên mỗi lượt bắt đầu cuộc trò chuyện qua tin nhắn" là trường Facebook có sẵn hay tính toán?');
  console.log('✅ Facebook CÓ SẴN field này: cost_per_messaging_conversation_started_7d');
  console.log('   - Không cần tự tính toán');
  console.log('   - Facebook tự động tính: spend ÷ messaging_conversation_started_7d');

  console.log('\n🔧 Cách thêm vào hệ thống:');
  console.log('1. Cập nhật fetchAdsetInsights() để lấy thêm fields:');
  console.log('   - messaging_conversation_started_7d');
  console.log('   - cost_per_messaging_conversation_started_7d');
  console.log('   - impressions');
  console.log('   - clicks');
  console.log('   - reach');

  console.log('\n2. Cập nhật schema để lưu trữ:');
  console.log('   - messagingConversationStarted7d: number');
  console.log('   - costPerMessagingConversation: number');
  console.log('   - impressions: number');
  console.log('   - clicks: number');
  console.log('   - reach: number');

  console.log('\n3. Cập nhật UI để hiển thị metric này');

  console.log('\n📊 Fields đề xuất cho fetchAdsetInsights():');
  const recommendedFields = [
    'spend',
    'cpm', 
    'cpc',
    'frequency',
    'impressions',
    'clicks', 
    'reach',
    'messaging_conversation_started_7d',
    'cost_per_messaging_conversation_started_7d',
    'messaging_first_reply',
    'date_start',
    'date_stop'
  ];
  
  console.log(`fields: '${recommendedFields.join(',')}'`);

  console.log('\n⚠️ Lưu ý quan trọng:');
  console.log('- Metric messaging chỉ có khi quảng cáo có objective là MESSAGES');
  console.log('- Cần đảm bảo Ad Account có quyền truy cập messaging insights');
  console.log('- Một số metrics có thể trả về null nếu không áp dụng');
}

checkMessagingMetrics();