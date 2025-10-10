const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const ChatMessage = mongoose.model('ChatMessage', {
      fanpageId: String,
      senderPsid: String,
      direction: String,
      content: String,
      isAI: Boolean,
      aiModelUsed: String,
      createdAt: Date
    });
    
    // Get latest messages for this conversation
    const messages = await ChatMessage.find({
      senderPsid: '24776034528751852'
    }).sort({createdAt: -1}).limit(10);
    
    console.log('\n=== Latest 10 Messages for PSID 24776034528751852 ===');
    messages.forEach((m, i) => {
      const time = m.createdAt ? m.createdAt.toLocaleString() : 'No time';
      const aiFlag = m.isAI ? '🤖 AI' : (m.direction === 'in' ? '👤 Customer' : '👨‍💼 Human');
      const model = m.aiModelUsed ? ` (${m.aiModelUsed})` : '';
      console.log(`${i+1}. ${time} | ${aiFlag}${model} | ${m.direction.toUpperCase()} | "${m.content}"`);
    });
    
    // Check if there are any AI messages
    const aiMessages = messages.filter(m => m.isAI === true);
    console.log(`\n🤖 AI Messages Count: ${aiMessages.length}`);
    
    // Check OpenAI Config
    const OpenAIConfig = mongoose.model('OpenAIConfig', {
      name: String,
      status: String,
      apiKey: String,
      isDefault: Boolean,
      model: String
    });
    
    const configs = await OpenAIConfig.find({status: 'active'});
    console.log(`\n⚙️ Active OpenAI Configs: ${configs.length}`);
    configs.forEach(c => {
      console.log(`- ${c.name} | Model: ${c.model || 'gpt-4o-mini'} | HasKey: ${c.apiKey ? 'Yes' : 'No'} | Default: ${c.isDefault}`);
    });
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Database error:', err);
    process.exit(1);
  });