const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const fs = require('fs/promises');
const path = require('path');

const router = express.Router();

const dataDir = path.join(__dirname, '../data');
const files = {
  portfolio: path.join(dataDir, 'portfolio.json'),
  services: path.join(dataDir, 'services.json'),
  slideshow: path.join(dataDir, 'slideshow.json'),
};

// Helper to read JSON
async function readJson(file) {
  const data = await fs.readFile(file, 'utf-8');
  return JSON.parse(data);
}

// @desc    Get portfolio data for main website
// @route   GET /api/portfolio
// @access  Public
router.get('/portfolio', asyncHandler(async (req, res) => {
  try {
    const data = await readJson(files.portfolio);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load portfolio data' });
  }
}));

// @desc    Get services data for main website
// @route   GET /api/services
// @access  Public
router.get('/services', asyncHandler(async (req, res) => {
  try {
    const data = await readJson(files.services);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load services data' });
  }
}));

// @desc    Get slideshow data for main website
// @route   GET /api/slideshow
// @access  Public
router.get('/slideshow', asyncHandler(async (req, res) => {
  try {
    const data = await readJson(files.slideshow);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load slideshow data' });
  }
}));

// @desc    Get individual project details for main website
// @route   GET /api/project/:id
// @access  Public
router.get('/project/:id', asyncHandler(async (req, res) => {
  try {
    const data = await readJson(files.portfolio);
    const projectId = parseInt(req.params.id);
    const project = data.find(item => item.id === projectId);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load project data' });
  }
}));

module.exports = router; 