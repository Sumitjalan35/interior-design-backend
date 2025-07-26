const express = require('express');
const path = require('path');
const fs = require('fs');
const { asyncHandler } = require('../middleware/errorHandler');
const { protect, admin, optionalAuth } = require('../middleware/auth');
const Project = require('../models/Project');
const { upload, uploadfile } = require('../middleware/upload');

const router = express.Router();

// Function to sync project with portfolio data
const syncProjectWithPortfolio = async (projectData, projectId) => {
  try {
    const portfolioPath = path.join(__dirname, '../data/portfolio.json');
    const portfolioData = JSON.parse(fs.readFileSync(portfolioPath, 'utf8'));
    
    // Find existing portfolio entry
    const existingIndex = portfolioData.findIndex(item => item.id === projectId.toString());
    
    // Create portfolio entry from project data
    const portfolioEntry = {
      id: projectId.toString(),
      title: projectData.title,
      description: projectData.description,
      longDescription: projectData.description,
      image: projectData.images?.[0]?.url || projectData.mainImage,
      mainImage: projectData.images?.[0]?.url || projectData.mainImage,
      images: projectData.images?.map(img => img.url) || [],
      category: projectData.category,
      sequence: projectData.sequence || 0,
      area: projectData.area ? `${projectData.area} sq ft` : 'N/A',
      duration: projectData.duration || 'N/A',
      location: projectData.location || 'N/A',
      budget: projectData.budget ? `₹${(projectData.budget / 100000).toFixed(1)} Lakhs` : 'N/A',
      features: projectData.services || [],
      testimonials: projectData.client?.testimonial ? [{
        rating: 5,
        content: projectData.client.testimonial,
        name: projectData.client.name || 'Client',
        role: 'Client'
      }] : []
    };
    
    if (existingIndex !== -1) {
      // Update existing entry
      portfolioData[existingIndex] = { ...portfolioData[existingIndex], ...portfolioEntry };
    } else {
      // Add new entry
      portfolioData.push(portfolioEntry);
    }
    
    // Sort by sequence
    portfolioData.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    
    // Write back to file
    fs.writeFileSync(portfolioPath, JSON.stringify(portfolioData, null, 2));
    
    console.log(`Portfolio synced for project ${projectId}`);
  } catch (error) {
    console.error('Error syncing portfolio:', error);
  }
};

// Function to remove project from portfolio data
const removeProjectFromPortfolio = async (projectId) => {
  try {
    const portfolioPath = path.join(__dirname, '../data/portfolio.json');
    const portfolioData = JSON.parse(fs.readFileSync(portfolioPath, 'utf8'));
    
    // Remove portfolio entry
    const filteredData = portfolioData.filter(item => item.id !== projectId.toString());
    
    // Write back to file
    fs.writeFileSync(portfolioPath, JSON.stringify(filteredData, null, 2));
    
    console.log(`Project ${projectId} removed from portfolio`);
  } catch (error) {
    console.error('Error removing project from portfolio:', error);
  }
};

// @desc    Get all published projects (public)
// @route   GET /api/projects
// @access  Public
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 12;
  const category = req.query.category;
  const featured = req.query.featured === 'true';
  const search = req.query.search;

  const query = { published: true };
  
  if (category) query.category = category;
  if (featured) query.featured = true;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } }
    ];
  }

  const projects = await Project.find(query)
    .populate('createdBy', 'username')
    .sort({ sequence: 1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await Project.countDocuments(query);

  // Increment views for authenticated users
  if (req.user) {
    projects.forEach(project => {
      project.incrementViews();
    });
  }

  res.json({
    success: true,
    data: projects,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
}));

// @desc    Get all projects with sequence info (admin only)
// @route   GET /api/projects/sequence
// @access  Private/Admin
router.get('/sequence', protect, admin, asyncHandler(async (req, res) => {
  const projects = await Project.find({})
    .populate('createdBy', 'username')
    .sort({ sequence: 1, createdAt: -1 })
    .select('_id title sequence category published featured');

  res.json({
    success: true,
    data: projects
  });
}));

// @desc    Update project sequence (admin only)
// @route   PUT /api/projects/sequence
// @access  Private/Admin
router.put('/sequence', protect, admin, asyncHandler(async (req, res) => {
  try {
    const { sequences } = req.body; // Array of { id, sequence }

    console.log('Received sequences update request:', sequences);

    if (!Array.isArray(sequences)) {
      return res.status(400).json({
        success: false,
        message: 'Sequences must be an array'
      });
    }

    // Update each project's sequence
    const updatePromises = sequences.map(async ({ id, sequence }) => {
      console.log(`Updating project ${id} with sequence ${sequence}`);
      return await Project.findByIdAndUpdate(id, { sequence: parseInt(sequence) }, { new: true });
    });

    const updatedProjects = await Promise.all(updatePromises);
    console.log('Successfully updated sequences for', updatedProjects.length, 'projects');

    res.json({
      success: true,
      message: 'Project sequences updated successfully',
      data: updatedProjects
    });
  } catch (error) {
    console.error('Error updating project sequences:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
}));

// @desc    Reorder projects (admin only)
// @route   POST /api/projects/reorder
// @access  Private/Admin
router.post('/reorder', protect, admin, asyncHandler(async (req, res) => {
  const { projectIds } = req.body; // Array of project IDs in new order

  if (!Array.isArray(projectIds)) {
    return res.status(400).json({
      success: false,
      message: 'Project IDs must be an array'
    });
  }

  // Update sequences based on array order
  const updatePromises = projectIds.map((id, index) => 
    Project.findByIdAndUpdate(id, { sequence: index + 1 }, { new: true })
  );

  await Promise.all(updatePromises);

  res.json({
    success: true,
    message: 'Projects reordered successfully'
  });
}));

// @desc    Get project statistics (admin only)
// @route   GET /api/projects/stats/overview
// @access  Private/Admin
router.get('/stats/overview', protect, admin, asyncHandler(async (req, res) => {
  const total = await Project.countDocuments();
  const published = await Project.countDocuments({ published: true });
  const featured = await Project.countDocuments({ featured: true });
  const totalViews = await Project.aggregate([
    { $group: { _id: null, totalViews: { $sum: '$views' } } }
  ]);

  res.json({
    success: true,
    data: {
      total,
      published,
      featured,
      totalViews: totalViews[0]?.totalViews || 0
    }
  });
}));

// @desc    Get featured projects (public)
// @route   GET /api/projects/featured
// @access  Public
router.get('/featured', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 6;
  const projects = await Project.getFeatured(limit);

  res.json({
    success: true,
    data: projects
  });
}));

// @desc    Get projects by category (public)
// @route   GET /api/projects/category/:category
// @access  Public
router.get('/category/:category', asyncHandler(async (req, res) => {
  const { category } = req.params;
  const limit = parseInt(req.query.limit) || 12;
  const projects = await Project.getByCategory(category, limit);

  res.json({
    success: true,
    data: projects
  });
}));

// @desc    Get single project (public)
// @route   GET /api/projects/:id
// @access  Public
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id)
    .populate('createdBy', 'username');

  if (!project) {
    return res.status(404).json({
      success: false,
      message: 'Project not found'
    });
  }

  if (!project.published && (!req.user || req.user.role !== 'admin')) {
    return res.status(404).json({
      success: false,
      message: 'Project not found'
    });
  }

  // Increment views
  await project.incrementViews();

  res.json({
    success: true,
    data: project
  });
}));

// @desc    Create new project (admin only)
// @route   POST /api/projects
// @access  Private/Admin
router.post('/', protect, admin, upload.array('images', 10), asyncHandler(async (req, res) => {
  const {
    title,
    description,
    category,
    location,
    area,
    budget,
    duration,
    services,
    tags,
    featured,
    published,
    sequence,
    clientName,
    clientTestimonial,
    materials,
    colors,
    furniture,
    lighting
  } = req.body;

  // Process uploaded images
  const images = req.files ? req.files.map((file, index) => ({
    url: file.path,
    alt: `${title} - Image ${index + 1}`,
    isPrimary: index === 0 // First image is primary
  })) : [];

  const projectData = {
    title,
    description,
    category,
    location,
    area: area ? parseInt(area) : undefined,
    budget: budget ? parseInt(budget) : undefined,
    duration,
    sequence: sequence ? parseInt(sequence) : 0,
    services: services ? JSON.parse(services) : [],
    tags: tags ? JSON.parse(tags) : [],
    featured: featured === 'true',
    published: published === 'true',
    images,
    client: {
      name: clientName,
      testimonial: clientTestimonial
    },
    specifications: {
      materials: materials ? JSON.parse(materials) : [],
      colors: colors ? JSON.parse(colors) : [],
      furniture: furniture ? JSON.parse(furniture) : [],
      lighting: lighting ? JSON.parse(lighting) : []
    },
    createdBy: req.user.id
  };

  const project = await Project.create(projectData);

  // Sync with portfolio data
  await syncProjectWithPortfolio(project, project._id);

  res.status(201).json({
    success: true,
    message: 'Project created successfully',
    data: project
  });
}));

// @desc    Update project (admin only)
// @route   PUT /api/projects/:id
// @access  Private/Admin
router.put('/:id', protect, admin, upload.fields([
  { name: 'images', maxCount: 20 },
  { name: 'mainImage', maxCount: 1 }
]), asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);

  if (!project) {
    return res.status(404).json({
      success: false,
      message: 'Project not found'
    });
  }

  const {
    title,
    description,
    category,
    location,
    area,
    budget,
    duration,
    services,
    tags,
    featured,
    published,
    sequence,
    clientName,
    clientTestimonial,
    materials,
    colors,
    furniture,
    lighting,
    existingImages
  } = req.body;

  // Process existing images
  let images = existingImages ? JSON.parse(existingImages) : [];

  // Add new uploaded images
  if (req.files && req.files['images'] && req.files['images'].length > 0) {
    const newImages = await Promise.all(req.files['images'].map(async (file, index) => {
      const { secure_url } = await uploadfile(file.path);
      return { url: secure_url, alt: `${title || project.title} - Image ${images.length + index + 1}`, isPrimary: images.length === 0 && index === 0 };
    }));
    images = [...images, ...newImages];
  }

  // Handle mainImage (hero image) upload
  if (req.files && req.files['mainImage'] && req.files['mainImage'][0]) {
    const file = req.files['mainImage'][0];
    const { secure_url } = await uploadfile(file.path);
    project.mainImage = secure_url;
  }

  // Update project fields
  if (title) project.title = title;
  if (description) project.description = description;
  if (category) project.category = category;
  if (location !== undefined) project.location = location;
  if (area !== undefined) project.area = parseInt(area);
  if (budget !== undefined) project.budget = parseInt(budget);
  if (duration !== undefined) project.duration = duration;
  if (sequence !== undefined) project.sequence = parseInt(sequence);
  if (services) project.services = JSON.parse(services);
  if (tags) project.tags = JSON.parse(tags);
  if (featured !== undefined) project.featured = featured === 'true';
  if (published !== undefined) project.published = published === 'true';
  if (images.length > 0) project.images = images;
  if (clientName !== undefined || clientTestimonial !== undefined) {
    project.client = {
      name: clientName || project.client?.name,
      testimonial: clientTestimonial || project.client?.testimonial
    };
  }
  if (materials || colors || furniture || lighting) {
    project.specifications = {
      materials: materials ? JSON.parse(materials) : project.specifications?.materials || [],
      colors: colors ? JSON.parse(colors) : project.specifications?.colors || [],
      furniture: furniture ? JSON.parse(furniture) : project.specifications?.furniture || [],
      lighting: lighting ? JSON.parse(lighting) : project.specifications?.lighting || []
    };
  }

  await project.save();

  // Sync with portfolio data
  await syncProjectWithPortfolio(project, project._id);

  res.json({
    success: true,
    message: 'Project updated successfully',
    data: project
  });
}));

// @desc    Delete project (admin only)
// @route   DELETE /api/projects/:id
// @access  Private/Admin
router.delete('/:id', protect, admin, asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);

  if (!project) {
    return res.status(404).json({
      success: false,
      message: 'Project not found'
    });
  }

  // Remove from portfolio data
  await removeProjectFromPortfolio(project._id);

  // Delete associated images
  project.images.forEach(image => {
    const imagePath = path.join(__dirname, '..', image.url);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  });

  await project.remove();

  res.json({
    success: true,
    message: 'Project deleted successfully'
  });
}));

// @desc    Like/unlike project (authenticated users)
// @route   POST /api/projects/:id/like
// @access  Private
router.post('/:id/like', protect, asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);

  if (!project) {
    return res.status(404).json({
      success: false,
      message: 'Project not found'
    });
  }

  await project.toggleLike();

  res.json({
    success: true,
    message: 'Project liked',
    data: { likes: project.likes }
  });
}));

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    let msg = err.message;
    if (err.code === 'LIMIT_FILE_SIZE') {
      msg = 'One or more images exceed the 20MB size limit.';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      msg = 'You can upload up to 20 images at once.';
    }
    return res.status(400).json({ error: msg });
  }
  next(err);
});

module.exports = router; 
