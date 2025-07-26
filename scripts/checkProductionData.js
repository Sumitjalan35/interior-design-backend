const mongoose = require('mongoose');
const Project = require('../models/Project');
const User = require('../models/User');
require('dotenv').config();

const checkProductionData = async () => {
  try {
    // Check for MongoDB URI
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI environment variable is required');
      console.log('Please set your production MongoDB URI:');
      console.log('export MONGODB_URI="your-production-mongodb-connection-string"');
      return;
    }

    console.log('🔗 Connecting to production MongoDB...');
    
    // Connect to MongoDB
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to production MongoDB');

    // Check for admin user
    const adminUser = await User.findOne({ role: 'superadmin' });
    if (!adminUser) {
      console.log('❌ No admin user found in production database');
    } else {
      console.log(`👤 Found admin user: ${adminUser.username}`);
    }

    // Check for projects
    const totalProjects = await Project.countDocuments();
    console.log(`📊 Total projects in database: ${totalProjects}`);

    if (totalProjects > 0) {
      console.log('\n📋 Existing projects:');
      const projects = await Project.find({})
        .select('_id title sequence category published featured')
        .sort({ sequence: 1 });
      
      projects.forEach(project => {
        console.log(`   ${project.sequence}. ${project.title} (ID: ${project._id})`);
      });
    } else {
      console.log('📭 No projects found in database');
      console.log('💡 You need to import portfolio data using:');
      console.log('   node scripts/importPortfolioProduction.js');
    }

    // Test the sequence API
    console.log('\n🧪 Testing sequence API...');
    try {
      const sequenceProjects = await Project.find({})
        .populate('createdBy', 'username')
        .sort({ sequence: 1, createdAt: -1 })
        .select('_id title sequence category published featured');
      
      console.log(`📋 Sequence API returned ${sequenceProjects.length} projects`);
    } catch (error) {
      console.error('❌ Error testing sequence API:', error.message);
    }

  } catch (error) {
    console.error('❌ Error checking production data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

console.log('🔍 Checking production database...');
console.log('⚠️  Make sure you have MONGODB_URI set to your production database');
console.log('');

checkProductionData(); 