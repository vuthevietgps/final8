/**
 * Script để sửa adGroupId trong advertising-cost-suggestions
 * Từ _id của document sang adGroupId thật
 */
const mongoose = require('mongoose');

async function fixAdGroupIds() {
  try {
    // Kết nối MongoDB
    await mongoose.connect('mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system');
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // Lấy tất cả advertising-cost-suggestions
    const suggestions = await db.collection('advertising_cost_suggestions').find({}).toArray();
    console.log(`Found ${suggestions.length} advertising cost suggestions`);

    // Lấy mapping từ _id sang adGroupId thật
    const adGroups = await db.collection('adgroups').find({}).toArray();
    const idMapping = {};
    
    adGroups.forEach(adGroup => {
      idMapping[adGroup._id.toString()] = adGroup.adGroupId;
      console.log(`Mapping: ${adGroup._id} -> ${adGroup.adGroupId} (${adGroup.name})`);
    });

    // Update từng suggestion
    for (const suggestion of suggestions) {
      const oldAdGroupId = suggestion.adGroupId;
      const newAdGroupId = idMapping[oldAdGroupId];
      
      if (newAdGroupId) {
        console.log(`Updating suggestion ${suggestion._id}: ${oldAdGroupId} -> ${newAdGroupId}`);
        
        await db.collection('advertising_cost_suggestions').updateOne(
          { _id: suggestion._id },
          { 
            $set: { 
              adGroupId: newAdGroupId  // Sử dụng adGroupId thật (string)
            } 
          }
        );
        
        console.log(`✅ Updated successfully`);
      } else {
        console.log(`❌ No mapping found for ${oldAdGroupId}`);
      }
    }

    console.log('Migration completed!');
    
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Chạy migration
fixAdGroupIds();