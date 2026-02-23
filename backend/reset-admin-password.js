const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/smarterp-dev';

async function resetAdminPassword() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find admin user
    const user = await mongoose.connection.db.collection('users').findOne({ email: 'admin@dropshipping.com' });
    if (!user) {
      console.log('Admin user not found!');
      return;
    }

    console.log('Found user:', user.email, '| Role:', user.role);
    console.log('Current password hash length:', user.password?.length);
    
    // Check if current password is '123456'
    const isMatch = await bcrypt.compare('123456', user.password);
    console.log('Password "123456" matches:', isMatch);
    
    if (!isMatch) {
      // Reset password to '123456'
      const newHash = await bcrypt.hash('123456', 12);
      await mongoose.connection.db.collection('users').updateOne(
        { email: 'admin@dropshipping.com' },
        { $set: { password: newHash } }
      );
      console.log('Password reset to "123456"');
    }

  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    await mongoose.disconnect();
  }
}

resetAdminPassword();
