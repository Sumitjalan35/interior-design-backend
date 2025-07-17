const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const SEO = require('../models/SEO');
const Project = require('../models/Project');
const BlogPost = require('../models/BlogPost');
require('dotenv').config();

const setupDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create superadmin user
    const existingAdmin = await User.findOne({ role: 'superadmin' });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin123', 12);
      const adminUser = new User({
        username: 'admin',
        email: 'admin@interiordesign.com',
        password: hashedPassword,
        role: 'superadmin',
        permissions: ['all'],
        isActive: true
      });
      await adminUser.save();
      console.log('✅ Superadmin user created');
    }

    // Create SEO data for pages
    const seoPages = [
      {
        page: 'home',
        title: 'Interior Design Studio - Transform Your Space',
        description: 'Professional interior design services for residential and commercial spaces. Create beautiful, functional environments that inspire.',
        keywords: ['interior design', 'home decor', 'space planning', 'furniture selection'],
        ogTitle: 'Interior Design Studio - Transform Your Space',
        ogDescription: 'Professional interior design services for residential and commercial spaces.',
        ogType: 'website',
        sitemapPriority: 1.0,
        sitemapChangeFreq: 'weekly'
      },
      {
        page: 'about',
        title: 'About Us - Interior Design Studio',
        description: 'Learn about our passion for interior design and our commitment to creating beautiful, functional spaces.',
        keywords: ['about us', 'interior designer', 'design philosophy', 'team'],
        ogTitle: 'About Us - Interior Design Studio',
        ogDescription: 'Learn about our passion for interior design and our commitment to creating beautiful spaces.',
        ogType: 'website',
        sitemapPriority: 0.8,
        sitemapChangeFreq: 'monthly'
      },
      {
        page: 'services',
        title: 'Our Services - Interior Design Studio',
        description: 'Comprehensive interior design services including space planning, furniture selection, and project management.',
        keywords: ['interior design services', 'space planning', 'furniture selection', 'project management'],
        ogTitle: 'Our Services - Interior Design Studio',
        ogDescription: 'Comprehensive interior design services for your space.',
        ogType: 'website',
        sitemapPriority: 0.8,
        sitemapChangeFreq: 'monthly'
      },
      {
        page: 'portfolio',
        title: 'Portfolio - Interior Design Projects',
        description: 'Explore our portfolio of completed interior design projects showcasing our creativity and expertise.',
        keywords: ['portfolio', 'interior design projects', 'before after', 'design examples'],
        ogTitle: 'Portfolio - Interior Design Projects',
        ogDescription: 'Explore our portfolio of completed interior design projects.',
        ogType: 'website',
        sitemapPriority: 0.9,
        sitemapChangeFreq: 'weekly'
      },
      {
        page: 'contact',
        title: 'Contact Us - Interior Design Studio',
        description: 'Get in touch with us for your interior design project. Free consultation available.',
        keywords: ['contact', 'interior design consultation', 'free quote', 'get in touch'],
        ogTitle: 'Contact Us - Interior Design Studio',
        ogDescription: 'Get in touch with us for your interior design project.',
        ogType: 'website',
        sitemapPriority: 0.7,
        sitemapChangeFreq: 'monthly'
      }
    ];

    for (const seoData of seoPages) {
      const existingSEO = await SEO.findOne({ page: seoData.page });
      if (!existingSEO) {
        await SEO.create(seoData);
        console.log(`✅ SEO data created for ${seoData.page}`);
      }
    }

    // Create sample projects
    const sampleProjects = [
      {
        title: 'Modern Living Room Transformation',
        description: 'A contemporary living room design featuring clean lines, neutral colors, and functional furniture.',
        category: 'residential',
        images: [
          {
            url: '/uploads/projects/living-room-1.jpg',
            alt: 'Modern living room before'
          },
          {
            url: '/uploads/projects/living-room-2.jpg',
            alt: 'Modern living room after'
          }
        ],
        client: {
          name: 'Sarah Johnson'
        },
        location: 'Downtown Apartment',
        budget: 15000,
        duration: '6 weeks',
        published: true,
        featured: true,
        createdBy: existingAdmin ? existingAdmin._id : (await User.findOne({ role: 'superadmin' }))._id
      },
      {
        title: 'Corporate Office Design',
        description: 'A collaborative workspace design that promotes productivity and employee well-being.',
        category: 'commercial',
        images: [
          {
            url: '/uploads/projects/office-1.jpg',
            alt: 'Office space design'
          }
        ],
        client: {
          name: 'TechStart Inc.'
        },
        location: 'Business District',
        budget: 50000,
        duration: '12 weeks',
        published: true,
        featured: true,
        createdBy: existingAdmin ? existingAdmin._id : (await User.findOne({ role: 'superadmin' }))._id
      }
    ];

    for (const projectData of sampleProjects) {
      const existingProject = await Project.findOne({ title: projectData.title });
      if (!existingProject) {
        await Project.create(projectData);
        console.log(`✅ Sample project created: ${projectData.title}`);
      }
    }

    // Create sample blog post
    const adminUser = existingAdmin || await User.findOne({ role: 'superadmin' });
    const sampleBlogPost = {
      title: 'Top Interior Design Trends for 2024',
      slug: 'top-interior-design-trends-2024',
      content: `
        <h2>Introduction</h2>
        <p>As we move into 2024, interior design continues to evolve with new trends that reflect our changing lifestyles and values. Here are the top trends to watch this year.</p>
        
        <h2>Sustainable Design</h2>
        <p>Sustainability is no longer just a buzzword—it's a fundamental aspect of modern interior design. Homeowners are increasingly choosing eco-friendly materials, energy-efficient lighting, and furniture made from sustainable sources.</p>
        
        <h2>Biophilic Design</h2>
        <p>Bringing nature indoors continues to be a major trend. This includes natural materials, indoor plants, and design elements that connect us to the natural world.</p>
        
        <h2>Smart Home Integration</h2>
        <p>Technology is seamlessly integrating into our living spaces, with smart lighting, automated window treatments, and voice-controlled systems becoming standard features.</p>
      `,
      excerpt: 'Discover the latest interior design trends that will dominate 2024, from sustainable materials to smart home integration.',
      category: 'trends',
      tags: ['trends', '2024', 'sustainable design', 'biophilic design'],
      published: true,
      author: adminUser._id
    };

    const existingBlogPost = await BlogPost.findOne({ title: sampleBlogPost.title });
    if (!existingBlogPost) {
      await BlogPost.create(sampleBlogPost);
      console.log('✅ Sample blog post created');
    }

    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Update your .env file with your actual credentials');
    console.log('2. Start the backend server: npm run dev');
    console.log('3. Start the frontend: cd .. && npm run dev');
    console.log('4. Access admin panel at: https://admin.beyondblueprint.co.in/admin');
    console.log('5. Login with: admin@interiordesign.com / admin123');

  } catch (error) {
    console.error('Error setting up database:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

setupDatabase(); 