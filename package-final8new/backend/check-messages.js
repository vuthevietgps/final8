const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Check ChatMessages
    const ChatMessage = mongoose.model('ChatMessage', {
      fanpageId: String,
      senderPsid: String,
      direction: String,
      content: String,
      isAI: Boolean,
      createdAt: Date,
      receivedAt: Date
    });
    
    const messages = await ChatMessage.find({}).sort({createdAt: -1}).limit(10);
    console.log('\n=== Latest 10 ChatMessages ===');
    messages.forEach(m => {
      console.log(`${m.createdAt ? m.createdAt.toISOString() : 'N/A'} | ${m.fanpageId} | ${m.senderPsid} | ${m.direction} | ${m.content} | AI: ${m.isAI || false}`);
    });
    
    // Check Conversations
    const Conversation = mongoose.model('Conversation', {
      fanpageId: String,
      senderPsid: String,
      autoAiEnabled: Boolean,
      needsHuman: Boolean,
      totalMessages: Number
    });
    
    const conversations = await Conversation.find({}).sort({lastMessageAt: -1}).limit(5);
    console.log('\n=== Latest 5 Conversations ===');
    conversations.forEach(c => {
      console.log(`${c.fanpageId} | ${c.senderPsid} | AI: ${c.autoAiEnabled} | NeedsHuman: ${c.needsHuman} | Total: ${c.totalMessages}`);
    });
    
    // Check Fanpages
    const Fanpage = mongoose.model('Fanpage', {
      pageId: String,
      name: String,
      aiEnabled: Boolean,
      openAIConfigId: String
    });
    
    const fanpages = await Fanpage.find({});
    console.log('\n=== Fanpages ===');
    fanpages.forEach(f => {
      console.log(`PageID: ${f.pageId} | Name: ${f.name} | AI: ${f.aiEnabled} | ConfigID: ${f.openAIConfigId || 'None'}`);
    });
    
    // Check OpenAI Configs
    const OpenAIConfig = mongoose.model('OpenAIConfig', {
      name: String,
      status: String,
      apiKey: String,
      isDefault: Boolean
    });
    
    const configs = await OpenAIConfig.find({});
    console.log('\n=== OpenAI Configs ===');
    configs.forEach(c => {
      console.log(`Name: ${c.name} | Status: ${c.status} | Default: ${c.isDefault} | HasKey: ${c.apiKey ? 'Yes' : 'No'}`);
    });
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Database error:', err);
    process.exit(1);
  });