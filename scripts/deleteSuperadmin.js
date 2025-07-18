const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function deleteSuperadmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    const result = await User.deleteOne({ role: 'superadmin' });
    if (result.deletedCount > 0) {
      console.log('✅ Superadmin user deleted successfully!');
    } else {
      console.log('No superadmin user found to delete.');
    }
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error deleting superadmin user:', err);
    process.exit(1);
  }
}

deleteSuperadmin(); 