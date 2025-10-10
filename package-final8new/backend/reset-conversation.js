const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const Conversation = mongoose.model('Conversation', {
      fanpageId: String,
      senderPsid: String,
      autoAiEnabled: Boolean,
      needsHuman: Boolean,
      totalMessages: Number
    });
    
    // Reset needsHuman for conversation with PSID 24776034528751852
    const result = await Conversation.updateMany(
      { senderPsid: '24776034528751852' },
      { needsHuman: false }
    );
    
    console.log('Updated conversation needsHuman status:', result);
    
    // Verify the update
    const conversations = await Conversation.find({ senderPsid: '24776034528751852' });
    console.log('Conversations after update:');
    conversations.forEach(c => {
      console.log(`${c.fanpageId} | ${c.senderPsid} | AI: ${c.autoAiEnabled} | NeedsHuman: ${c.needsHuman}`);
    });
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Database error:', err);
    process.exit(1);
  });