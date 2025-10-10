const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const Fanpage = mongoose.model('Fanpage', {
      pageId: String,
      name: String,
      aiEnabled: Boolean,
      openAIConfigId: String
    });
    
    // Enable AI for fanpage
    const result = await Fanpage.updateOne(
      { pageId: '841956248994132' },
      { aiEnabled: true }
    );
    
    console.log('Updated fanpage AI status:', result);
    
    // Verify the update
    const fanpage = await Fanpage.findOne({ pageId: '841956248994132' });
    console.log('Fanpage after update:', {
      pageId: fanpage.pageId,
      name: fanpage.name,
      aiEnabled: fanpage.aiEnabled,
      openAIConfigId: fanpage.openAIConfigId
    });
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Database error:', err);
    process.exit(1);
  });