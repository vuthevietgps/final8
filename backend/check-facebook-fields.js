/**
 * Script để kiểm tra tất cả các fields có sẵn từ Facebook Ads Insights API
 */
const axios = require('axios');

async function checkAvailableFields() {
  console.log('=== FACEBOOK ADS INSIGHTS - AVAILABLE FIELDS ===\n');

  // Danh sách các fields phổ biến có thể lấy từ Facebook Ads Insights
  const commonFields = [
    // Chi phí và ngân sách
    'spend', 'account_currency', 'account_id', 'budget_remaining',
    
    // Metrics cơ bản
    'impressions', 'clicks', 'reach', 'frequency',
    
    // Chuyển đổi và tương tác
    'actions', 'conversions', 'conversion_values', 'cost_per_action_value',
    
    // Chi phí
    'cpm', 'cpc', 'cpp', 'ctr', 'cost_per_conversion',
    
    // Messaging metrics (quan trọng cho chatbot)
    'messaging_conversation_started_7d',
    'messaging_first_reply',
    'messaging_purchase_conversion_value_7d',
    'messaging_conversation_started_7d_unique',
    
    // Video metrics
    'video_avg_time_watched_actions', 'video_p25_watched_actions',
    'video_p50_watched_actions', 'video_p75_watched_actions',
    'video_p100_watched_actions',
    
    // Attribution metrics
    'attribution_setting', 'buying_type', 'campaign_id', 'adset_id', 'ad_id',
    
    // Thời gian
    'date_start', 'date_stop',
    
    // Device và placement
    'device_platform', 'placement', 'platform_position',
    
    // Demographic
    'age', 'gender', 'country',
    
    // Website actions
    'website_clicks', 'website_ctr', 'link_clicks',
    
    // Mobile app
    'mobile_app_install', 'app_install_cost',
    
    // Lead generation
    'leads', 'cost_per_lead',
    
    // Purchase
    'purchase_value', 'purchases', 'cost_per_purchase'
  ];

  console.log('📊 Các fields hiện tại đang lấy:');
  console.log('- spend (Chi phí)');
  console.log('- cpm (Chi phí trên 1000 lượt hiển thị)');  
  console.log('- cpc (Chi phí trên mỗi click)');
  console.log('- frequency (Tần suất hiển thị)');
  console.log('- date_start, date_stop (Thời gian)');
  
  console.log('\n💬 Cho conversation metrics:');
  console.log('- spend (Chi phí)');
  console.log('- messaging_conversation_started_7d (Số cuộc hội thoại bắt đầu trong 7 ngày)');
  console.log('- impressions (Lượt hiển thị)');
  console.log('- clicks (Lượt click)');

  console.log('\n🎯 Các fields bổ sung có thể hữu ích:');
  
  const recommendedFields = {
    'Conversation & Messaging': [
      'messaging_first_reply',
      'messaging_conversation_started_7d_unique', 
      'messaging_purchase_conversion_value_7d'
    ],
    'Conversion Tracking': [
      'actions',
      'conversions', 
      'conversion_values',
      'cost_per_conversion'
    ],
    'Engagement': [
      'impressions',
      'clicks', 
      'reach',
      'link_clicks',
      'website_clicks'
    ],
    'Lead Generation': [
      'leads',
      'cost_per_lead'
    ],
    'E-commerce': [
      'purchases',
      'purchase_value', 
      'cost_per_purchase'
    ],
    'Video Performance': [
      'video_p25_watched_actions',
      'video_p50_watched_actions',
      'video_p75_watched_actions',
      'video_p100_watched_actions'
    ]
  };

  Object.entries(recommendedFields).forEach(([category, fields]) => {
    console.log(`\n${category}:`);
    fields.forEach(field => console.log(`  - ${field}`));
  });

  console.log('\n📝 Schema hiện tại trong database:');
  console.log('- date: Date (Ngày)');
  console.log('- frequency: Number (Tần suất)');  
  console.log('- adGroupId: String (ID nhóm quảng cáo)');
  console.log('- spentAmount: Number (Số tiền đã chi)');
  console.log('- cpm: Number (Chi phí trên 1000 hiển thị)');
  console.log('- cpc: Number (Chi phí trên mỗi click)');

  console.log('\n🔧 Đề xuất cải tiến:');
  console.log('1. Thêm fields conversation metrics để tính chính xác cost per conversation');
  console.log('2. Thêm impressions, clicks để có CTR (Click Through Rate)');
  console.log('3. Thêm reach để biết độ phủ sóng');  
  console.log('4. Thêm conversions để theo dõi chuyển đổi');
  console.log('5. Thêm actions để phân tích hành động người dùng');

  console.log('\n⚡ Cải tiến schema đề xuất:');
  console.log(`
@Schema({ timestamps: true })
export class AdvertisingCost {
  @Prop({ type: Date, required: true, default: () => new Date() })
  date: Date;

  @Prop({ type: String, required: true, index: true, trim: true })
  adGroupId: string;

  // Chi phí
  @Prop({ type: Number, required: false, default: 0 })
  spentAmount?: number;

  @Prop({ type: Number, required: false, default: 0 })
  cpm?: number;

  @Prop({ type: Number, required: false, default: 0 })
  cpc?: number;

  // Hiệu suất cơ bản  
  @Prop({ type: Number, required: false, default: 0 })
  impressions?: number;

  @Prop({ type: Number, required: false, default: 0 })
  clicks?: number;

  @Prop({ type: Number, required: false, default: 0 })
  reach?: number;

  @Prop({ type: Number, required: false })
  frequency?: number;

  // Conversation metrics (cho chatbot)
  @Prop({ type: Number, required: false, default: 0 })
  messagingConversationStarted7d?: number;

  @Prop({ type: Number, required: false, default: 0 })
  messagingFirstReply?: number;

  // Conversion metrics
  @Prop({ type: Number, required: false, default: 0 })
  conversions?: number;

  @Prop({ type: Number, required: false, default: 0 })
  conversionValue?: number;

  // Lead metrics
  @Prop({ type: Number, required: false, default: 0 })
  leads?: number;

  // Purchase metrics  
  @Prop({ type: Number, required: false, default: 0 })
  purchases?: number;

  @Prop({ type: Number, required: false, default: 0 })
  purchaseValue?: number;
}
  `);
}

checkAvailableFields().catch(console.error);