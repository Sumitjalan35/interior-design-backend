const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Project = require('../models/Project');
const User = require('../models/User');
require('dotenv').config();

const importPortfolioProduction = async () => {
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
    await mongoose.connect(mongoUri, {
      // Add any production-specific options here
    });
    console.log('✅ Connected to production MongoDB');

    // Get admin user
    const adminUser = await User.findOne({ role: 'superadmin' });
    if (!adminUser) {
      console.error('❌ No admin user found. Please ensure admin user exists in production database.');
      return;
    }

    console.log(`👤 Found admin user: ${adminUser.username}`);

    // Read portfolio data from JSON file
    const portfolioPath = path.join(__dirname, '../data/portfolio.json');
    const portfolioData = JSON.parse(fs.readFileSync(portfolioPath, 'utf8'));

    console.log(`📁 Found ${portfolioData.length} projects in portfolio.json`);

    // Import each project
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const projectData of portfolioData) {
      try {
        // Check if project already exists
        const existingProject = await Project.findOne({ title: projectData.title });
        
        if (existingProject) {
          console.log(`⏭️  Project already exists: ${projectData.title}`);
          skippedCount++;
          continue;
        }

        // Transform portfolio data to Project model format
        const projectDoc = {
          title: projectData.title,
          description: projectData.description || 'Project description',
          category: projectData.category || 'residential', // Default to residential if category is missing
          images: projectData.images.map((img, index) => ({
            url: img,
            alt: `${projectData.title} - Image ${index + 1}`,
            isPrimary: index === 0
          })),
          location: projectData.location || 'Location not specified',
          area: parseInt(projectData.area?.replace(/\D/g, '')) || 0,
          budget: parseInt(projectData.budget?.replace(/\D/g, '')) || 0,
          duration: projectData.duration || 'Duration not specified',
          sequence: projectData.sequence || 0,
          featured: projectData.featured || false,
          published: projectData.published !== false,
          client: {
            name: projectData.title.split(' ').slice(1).join(' ') || projectData.title,
            testimonial: projectData.testimonials?.[0]?.content || ''
          },
          tags: projectData.features || [],
          createdBy: adminUser._id
        };

        // Create the project
        const newProject = new Project(projectDoc);
        await newProject.save();
        
        console.log(`✅ Imported: ${projectData.title} (Sequence: ${projectData.sequence})`);
        importedCount++;
      } catch (error) {
        console.error(`❌ Error importing ${projectData.title}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n🎉 Portfolio import completed!');
    console.log('\n📊 Summary:');
    console.log(`✅ Successfully imported: ${importedCount} projects`);
    console.log(`⏭️  Skipped (already exists): ${skippedCount} projects`);
    console.log(`❌ Errors: ${errorCount} projects`);
    
    const totalProjects = await Project.countDocuments();
    console.log(`📈 Total projects in database: ${totalProjects}`);

    // Test the sequence API
    console.log('\n🧪 Testing sequence API...');
    try {
      const projects = await Project.find({})
        .populate('createdBy', 'username')
        .sort({ sequence: 1, createdAt: -1 })
        .select('_id title sequence category published featured');
      
      console.log(`📋 Found ${projects.length} projects with sequence data:`);
      projects.forEach(project => {
        console.log(`   ${project.sequence}. ${project.title} (${project.category})`);
      });
    } catch (error) {
      console.error('❌ Error testing sequence API:', error.message);
    }

  } catch (error) {
    console.error('Error importing portfolio:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Check if running in production mode
if (process.env.NODE_ENV === 'production') {
  console.log('🚀 Running in production mode');
} else {
  console.log('🔧 Running in development mode');
}

console.log('⚠️  WARNING: This will import data to your PRODUCTION database!');
console.log('Make sure you have the correct MONGODB_URI set.');
console.log('');

importPortfolioProduction(); 