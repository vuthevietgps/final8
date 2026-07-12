const mongoose = require('mongoose');
const MONGODB_URI = process.env.MONGODB_URI;

async function checkUsersFull() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const users = await mongoose.connection.db.collection('users').find({}).limit(15).toArray();
    console.log('\nUsers in DB:', users.length);
    
    users.forEach(u => {
      console.log('Email:', u.email, '| Role:', u.role, '| Active:', u.isActive, '| Name:', u.fullName);
    });

    // Check salary configs
    const salaryConfigs = await mongoose.connection.db.collection('salaryconfigs').find({}).limit(10).toArray();
    console.log('\nSalary Configs:', salaryConfigs.length);
    salaryConfigs.forEach(s => {
      console.log('UserId:', s.userId, '| Rate:', s.hourlyRate);
    });

  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkUsersFull();
