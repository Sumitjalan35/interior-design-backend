const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Project = require('../models/Project');
const User = require('../models/User');
require('dotenv').config();

const importPortfolio = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get admin user
    const adminUser = await User.findOne({ role: 'superadmin' });
    if (!adminUser) {
      console.error('❌ No admin user found. Please run setup.js first.');
      return;
    }

    // Read portfolio data from JSON file
    const portfolioPath = path.join(__dirname, '../data/portfolio.json');
    const portfolioData = JSON.parse(fs.readFileSync(portfolioPath, 'utf8'));

    console.log(`📁 Found ${portfolioData.length} projects in portfolio.json`);

    // Import each project
    for (const projectData of portfolioData) {
      try {
        // Check if project already exists
        const existingProject = await Project.findOne({ title: projectData.title });
        
        if (existingProject) {
          console.log(`⏭️  Project already exists: ${projectData.title}`);
          continue;
        }

        // Transform portfolio data to Project model format
        const projectDoc = {
          title: projectData.title,
          description: projectData.description,
          category: projectData.category || 'residential', // Default to residential if category is missing
          images: projectData.images.map((img, index) => ({
            url: img,
            alt: `${projectData.title} - Image ${index + 1}`,
            isPrimary: index === 0
          })),
          location: projectData.location,
          area: parseInt(projectData.area?.replace(/\D/g, '')) || 0,
          budget: parseInt(projectData.budget?.replace(/\D/g, '')) || 0,
          duration: projectData.duration,
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
      } catch (error) {
        console.error(`❌ Error importing ${projectData.title}:`, error.message);
      }
    }

    console.log('\n🎉 Portfolio import completed!');
    console.log('\n📊 Summary:');
    const totalProjects = await Project.countDocuments();
    console.log(`Total projects in database: ${totalProjects}`);

  } catch (error) {
    console.error('Error importing portfolio:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

importPortfolio(); 