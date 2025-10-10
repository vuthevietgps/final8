const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const Fanpage = mongoose.model('Fanpage', {
      pageId: String,
      name: String,
      aiEnabled: Boolean,
      openAIConfigId: String,
      accessToken: String
    });
    
    // Check current token
    const fanpage = await Fanpage.findOne({ pageId: '841956248994132' });
    console.log('Current fanpage access token:', fanpage.accessToken ? fanpage.accessToken.substring(0, 20) + '...' : 'NONE');
    
    console.log('\nTo fix this, you need to:');
    console.log('1. Go to Facebook Graph API Explorer: https://developers.facebook.com/tools/explorer/');
    console.log('2. Select your page and generate a new Page Access Token');
    console.log('3. Update the fanpage access token in database or via UI');
    console.log('4. The token should start with something like: EAAxxxxxxxxxx...');
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Database error:', err);
    process.exit(1);
  });