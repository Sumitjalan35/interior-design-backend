const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { protect, admin, checkPermission } = require('../middleware/auth');
const User = require('../models/User');
const Contact = require('../models/Contact');
const Project = require('../models/Project');
const { Parser } = require('json2csv');
const fs = require('fs/promises');
const path = require('path');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const { upload, uploadfile } = require('../middleware/upload');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'bb-root',
  api_key: process.env.CLOUDINARY_API_KEY || '433893671529262',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'qth_FC6o6lyIgt0oNEa4oNsDEu8',
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'admin_uploads',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
  },
});
const upload = require('multer')({ storage: storage });

const dataDir = path.join(__dirname, '../data');
const files = {
  portfolio: path.join(dataDir, 'portfolio.json'),
  services: path.join(dataDir, 'services.json'),
  slideshow: path.join(dataDir, 'slideshow.json'),
};

// Helper to read/write JSON
async function readJson(file) {
  const data = await fs.readFile(file, 'utf-8');
  return JSON.parse(data);
}
async function writeJson(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

const router = express.Router();

// --- Image Upload with proper authentication ---
router.post('/upload', protect, admin, upload.array('images', 20), async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  try {
    const uploadPromises = req.files.map(async (file) => {
      const result = await uploadfile(file.path);
      return result?.secure_url;
    });
    const urls = await Promise.all(uploadPromises);
    if (urls.length === 1) {
      return res.json({ url: urls[0] });
    }
    return res.json({ urls });
  } catch (err) {
    next(err);
  }
});

// All other routes require admin authentication
router.use(protect, admin);

// @desc    Get admin dashboard overview
// @route   GET /api/admin/dashboard
// @access  Private/Admin
router.get('/dashboard', asyncHandler(async (req, res) => {
  // Get counts
  const userCount = await User.countDocuments();
  const contactCount = await Contact.countDocuments();
  const projectCount = await Project.countDocuments();
  const publishedProjectCount = await Project.countDocuments({ published: true });

  // Get recent activity
  const recentContacts = await Contact.find()
    .sort({ createdAt: -1 })
    .limit(5);

  const recentProjects = await Project.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('createdBy', 'username');

  // Get statistics for charts
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  const contactsLast7Days = await Contact.countDocuments({
    createdAt: { $gte: last7Days }
  });

  const projectsLast7Days = await Project.countDocuments({
    createdAt: { $gte: last7Days }
  });

  // Get top performing projects
  const topProjects = await Project.find({ published: true })
    .sort({ views: -1 })
    .limit(5)
    .select('title views likes');

  // Get spam statistics
  const spamCount = await Contact.countDocuments({ isSpam: true });
  const spamPercentage = contactCount > 0 ? ((spamCount / contactCount) * 100).toFixed(1) : 0;

  res.json({
    success: true,
    data: {
      overview: {
        users: userCount,
        contacts: contactCount,
        projects: projectCount,
        publishedProjects: publishedProjectCount,
        spamCount,
        spamPercentage
      },
      recentActivity: {
        contacts: recentContacts,
        projects: recentProjects
      },
      last7Days: {
        contacts: contactsLast7Days,
        projects: projectsLast7Days
      },
      topProjects
    }
  });
}));

// @desc    Get all users (admin only)
// @route   GET /api/admin/users
// @access  Private/Admin
router.get('/users', protect, checkPermission('manage_users'), asyncHandler(async (req, res) => {
  const users = await User.find().select('-password').sort({ createdAt: -1 });
  
  res.json({
    success: true,
    data: users
  });
}));

// @desc    Get user by ID (admin only)
// @route   GET /api/admin/users/:id
// @access  Private/Admin
router.get('/users/:id', protect, checkPermission('manage_users'), asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  res.json({
    success: true,
    data: user
  });
}));

// @desc    Update user role/permissions (admin only)
// @route   PUT /api/admin/users/:id/role
// @access  Private/Superadmin
router.put('/users/:id/role', protect, checkPermission('manage_users'), asyncHandler(async (req, res) => {
  const { role, permissions } = req.body;
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  if (role) user.role = role;
  if (permissions) user.permissions = permissions;
  
  await user.save();
  
  res.json({
    success: true,
    message: 'User role updated successfully',
    data: user
  });
}));

// @desc    Deactivate/activate user (admin only)
// @route   PUT /api/admin/users/:id/status
// @access  Private/Admin
router.put('/users/:id/status', protect, checkPermission('manage_users'), asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  user.isActive = isActive;
  await user.save();
  
  res.json({
    success: true,
    message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
    data: user
  });
}));

// @desc    Delete user (admin only)
// @route   DELETE /api/admin/users/:id
// @access  Private/Superadmin
router.delete('/users/:id', protect, checkPermission('manage_users'), asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  // Prevent deleting the last superadmin
  if (user.role === 'superadmin') {
    const superadminCount = await User.countDocuments({ role: 'superadmin' });
    if (superadminCount <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the last superadmin'
      });
    }
  }
  
  await user.remove();
  
  res.json({
    success: true,
    message: 'User deleted successfully'
  });
}));

// @desc    Get contact management data
// @route   GET /api/admin/contacts
// @access  Private/Admin
router.get('/contacts', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const status = req.query.status;
  const isSpam = req.query.isSpam;

  const query = {};
  if (status) query.status = status;
  if (isSpam !== undefined) query.isSpam = isSpam === 'true';

  const contacts = await Contact.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await Contact.countDocuments(query);

  // Decrypt sensitive data
  const contactsWithDecryptedData = contacts.map(contact => {
    const contactObj = contact.toObject();
    const decryptedData = contact.decryptSensitiveData();
    if (decryptedData) {
      contactObj.name = decryptedData.name;
      contactObj.email = decryptedData.email;
      contactObj.phone = decryptedData.phone;
      contactObj.message = decryptedData.message;
    }
    return contactObj;
  });

  res.json({
    success: true,
    data: contactsWithDecryptedData,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
}));

// @desc    Update contact status
// @route   PUT /api/admin/contacts/:id
// @access  Private/Admin
router.put('/contacts/:id', asyncHandler(async (req, res) => {
  const { status } = req.body;

  const contact = await Contact.findById(req.params.id);
  if (!contact) {
    return res.status(404).json({
      success: false,
      message: 'Contact not found'
    });
  }

  if (status) contact.status = status;
  await contact.save();

  res.json({
    success: true,
    message: 'Contact status updated',
    data: contact
  });
}));

// @desc    Get project management data
// @route   GET /api/admin/projects
// @access  Private/Admin
router.get('/projects', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const published = req.query.published;
  const featured = req.query.featured;
  const category = req.query.category;

  const query = {};
  if (published !== undefined) query.published = published === 'true';
  if (featured !== undefined) query.featured = featured === 'true';
  if (category) query.category = category;

  const projects = await Project.find(query)
    .populate('createdBy', 'username')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await Project.countDocuments(query);

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

// @desc    Get system statistics
// @route   GET /api/admin/stats
// @access  Private/Admin
router.get('/stats', asyncHandler(async (req, res) => {
  // User statistics
  const totalUsers = await User.countDocuments();
  const activeUsers = await User.countDocuments({ isActive: true });
  const adminUsers = await User.countDocuments({ role: 'admin' });

  // Contact statistics
  const totalContacts = await Contact.countDocuments();
  const newContacts = await Contact.countDocuments({ status: 'new' });
  const spamContacts = await Contact.countDocuments({ isSpam: true });

  // Project statistics
  const totalProjects = await Project.countDocuments();
  const publishedProjects = await Project.countDocuments({ published: true });
  const featuredProjects = await Project.countDocuments({ featured: true });

  // Views and engagement
  const totalViews = await Project.aggregate([
    { $group: { _id: null, totalViews: { $sum: '$views' } } }
  ]);

  const totalLikes = await Project.aggregate([
    { $group: { _id: null, totalLikes: { $sum: '$likes' } } }
  ]);

  // Recent activity (last 30 days)
  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);

  const recentUsers = await User.countDocuments({
    createdAt: { $gte: last30Days }
  });

  const recentContacts = await Contact.countDocuments({
    createdAt: { $gte: last30Days }
  });

  const recentProjects = await Project.countDocuments({
    createdAt: { $gte: last30Days }
  });

  res.json({
    success: true,
    data: {
      users: {
        total: totalUsers,
        active: activeUsers,
        admins: adminUsers,
        recent: recentUsers
      },
      contacts: {
        total: totalContacts,
        new: newContacts,
        spam: spamContacts,
        recent: recentContacts
      },
      projects: {
        total: totalProjects,
        published: publishedProjects,
        featured: featuredProjects,
        recent: recentProjects
      },
      engagement: {
        totalViews: totalViews[0]?.totalViews || 0,
        totalLikes: totalLikes[0]?.totalLikes || 0
      }
    }
  });
}));

// @desc    Get activity log (recent actions)
// @route   GET /api/admin/activity
// @access  Private/Admin
router.get('/activity', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;

  // Get recent contacts
  const recentContacts = await Contact.find()
    .sort({ createdAt: -1 })
    .limit(limit / 2)
    .select('createdAt status isSpam');

  // Get recent projects
  const recentProjects = await Project.find()
    .sort({ createdAt: -1 })
    .limit(limit / 2)
    .select('title createdAt published featured')
    .populate('createdBy', 'username');

  // Combine and sort by date
  const activity = [
    ...recentContacts.map(contact => ({
      type: 'contact',
      action: contact.isSpam ? 'spam_detected' : 'new_submission',
      data: contact,
      timestamp: contact.createdAt
    })),
    ...recentProjects.map(project => ({
      type: 'project',
      action: project.published ? 'published' : 'created',
      data: project,
      timestamp: project.createdAt
    }))
  ].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);

  res.json({
    success: true,
    data: activity
  });
}));

// --- Analytics Endpoints ---
// @desc    Get contact analytics (counts, spam ratio, trends)
// @route   GET /api/admin/analytics/contacts
// @access  Private/Admin or Permission
router.get('/analytics/contacts', checkPermission('view_analytics'), asyncHandler(async (req, res) => {
  const total = await Contact.countDocuments();
  const spam = await Contact.countDocuments({ isSpam: true });
  const real = total - spam;
  const today = await Contact.countDocuments({ createdAt: { $gte: new Date().setHours(0,0,0,0) } });
  const last7 = await Contact.aggregate([
    { $match: { createdAt: { $gte: new Date(Date.now() - 7*24*60*60*1000) } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
  res.json({ success: true, data: { total, spam, real, today, last7 } });
}));

// --- Role Management Endpoints ---
// @desc    Update user role/permissions
// @route   PUT /api/admin/users/:id/role
// @access  Private/Superadmin
router.put('/users/:id/role', checkPermission('manage_users'), asyncHandler(async (req, res) => {
  const { role, permissions } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  if (role) user.role = role;
  if (permissions) user.permissions = permissions;
  await user.save();
  res.json({ success: true, data: user });
}));

// --- CSV Export Endpoints ---
// @desc    Export contacts as CSV
// @route   GET /api/admin/export/contacts
// @access  Private/Admin or Permission
router.get('/export/contacts', checkPermission('export_data'), asyncHandler(async (req, res) => {
  const contacts = await Contact.find();
  const parser = new Parser();
  const csv = parser.parse(contacts.map(c => ({
    ...c.toObject(),
    decrypted: c.decryptSensitiveData()
  })));
  res.header('Content-Type', 'text/csv');
  res.attachment('contacts.csv');
  return res.send(csv);
}));

// @desc    Export projects as CSV
// @route   GET /api/admin/export/projects
// @access  Private/Admin or Permission
router.get('/export/projects', checkPermission('export_data'), asyncHandler(async (req, res) => {
  const projects = await Project.find();
  const parser = new Parser();
  const csv = parser.parse(projects);
  res.header('Content-Type', 'text/csv');
  res.attachment('projects.csv');
  return res.send(csv);
}));

// --- Portfolio CRUD (JSON-based) ---
router.get('/portfolio', asyncHandler(async (req, res) => {
  try {
    const items = await readJson(files.portfolio);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load portfolio data' });
  }
}));

router.get('/portfolio/:id', asyncHandler(async (req, res) => {
  try {
    const items = await readJson(files.portfolio);
    const projectId = parseInt(req.params.id);
    const item = items.find(i => i.id === projectId);
    if (!item) return res.status(404).json({ error: 'Project not found' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load project data' });
  }
}));

router.post('/portfolio', asyncHandler(async (req, res) => {
  try {
    const items = await readJson(files.portfolio);
    const newId = Math.max(...items.map(i => i.id), 0) + 1;
    const newItem = { ...req.body, id: newId };
    items.push(newItem);
    await writeJson(files.portfolio, items);
    res.json(newItem);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create project' });
  }
}));

router.put('/portfolio/:id', asyncHandler(async (req, res) => {
  try {
    const items = await readJson(files.portfolio);
    const projectId = parseInt(req.params.id);
    const idx = items.findIndex(i => i.id === projectId);
    if (idx === -1) return res.status(404).json({ error: 'Project not found' });
    items[idx] = { ...items[idx], ...req.body };
    await writeJson(files.portfolio, items);
    res.json(items[idx]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update project' });
  }
}));

router.delete('/portfolio/:id', asyncHandler(async (req, res) => {
  try {
    let items = await readJson(files.portfolio);
    const projectId = parseInt(req.params.id);
    items = items.filter(i => i.id !== projectId);
    await writeJson(files.portfolio, items);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
}));

// --- Services CRUD (JSON-based) ---
router.get('/services', asyncHandler(async (req, res) => {
  try {
    const items = await readJson(files.services);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load services data' });
  }
}));

// Add this GET endpoint for a single service by id
router.get('/services/:id', asyncHandler(async (req, res) => {
  try {
    const items = await readJson(files.services);
    const item = items.find(i => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Service not found' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load service data' });
  }
}));

router.post('/services', asyncHandler(async (req, res) => {
  try {
    const items = await readJson(files.services);
    const newId = Math.max(...items.map(i => i.id), 0) + 1;
    const newItem = { ...req.body, id: newId };
    items.push(newItem);
    await writeJson(files.services, items);
    res.json(newItem);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create service' });
  }
}));

// Add this PUT endpoint for updating a service by id
router.put('/services/:id', asyncHandler(async (req, res) => {
  try {
    const items = await readJson(files.services);
    const index = items.findIndex(i => i.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Service not found' });
    items[index] = { ...items[index], ...req.body };
    await writeJson(files.services, items);
    res.json(items[index]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update service' });
  }
}));

router.delete('/services/:id', asyncHandler(async (req, res) => {
  try {
    let items = await readJson(files.services);
    const serviceId = parseInt(req.params.id);
    items = items.filter(i => i.id !== serviceId);
    await writeJson(files.services, items);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete service' });
  }
}));

// --- Slideshow CRUD (JSON-based) ---
router.get('/slideshow', asyncHandler(async (req, res) => {
  try {
    const items = await readJson(files.slideshow);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load slideshow data' });
  }
}));

router.post('/slideshow', asyncHandler(async (req, res) => {
  try {
    const items = await readJson(files.slideshow);
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'Image required' });
    items.push(image);
    await writeJson(files.slideshow, items);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add slideshow image' });
  }
}));

router.delete('/slideshow/:idx', asyncHandler(async (req, res) => {
  try {
    let items = await readJson(files.slideshow);
    const idx = parseInt(req.params.idx);
    if (isNaN(idx) || idx < 0 || idx >= items.length) return res.status(404).json({ error: 'Image not found' });
    items.splice(idx, 1);
    await writeJson(files.slideshow, items);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete slideshow image' });
  }
}));

module.exports = router; 
