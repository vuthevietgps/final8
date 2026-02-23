const mongoose = require('mongoose');

async function test() {
  try {
    await mongoose.connect('mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/smarterp-dev');
    console.log('Connected to MongoDB');
    
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    
    // Test findById
    const user = await User.findById('695b87133d71da16072a5df2');
    console.log('User by ID:', user ? user.email : 'NOT FOUND');
    
    // Test find by email
    const userByEmail = await User.findOne({ email: 'vutheviet@gmail.com' });
    console.log('User by email:', userByEmail ? { id: userByEmail._id, email: userByEmail.email } : 'NOT FOUND');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

test();
