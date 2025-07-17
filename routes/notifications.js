const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { protect, checkPermission } = require('../middleware/auth');
const Notification = require('../models/Notification');
const User = require('../models/User');

const router = express.Router();

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
router.get('/', protect, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const unreadOnly = req.query.unread === 'true';

  let notifications;
  if (unreadOnly) {
    notifications = await Notification.getUnread(req.user.id, limit);
  } else {
    notifications = await Notification.getForUser(req.user.id, page, limit);
  }

  const unreadCount = await Notification.getUnreadCount(req.user.id);

  res.json({
    success: true,
    data: notifications,
    unreadCount
  });
}));

// @desc    Mark notifications as read
// @route   PUT /api/notifications/read
// @access  Private
router.put('/read', protect, asyncHandler(async (req, res) => {
  const { notificationIds } = req.body;

  if (notificationIds && notificationIds.length > 0) {
    await Notification.markAsRead(req.user.id, notificationIds);
  } else {
    // Mark all as read
    await Notification.markAllAsRead(req.user.id);
  }

  const unreadCount = await Notification.getUnreadCount(req.user.id);

  res.json({
    success: true,
    message: 'Notifications marked as read',
    unreadCount
  });
}));

// @desc    Mark single notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
router.put('/:id/read', protect, asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    recipient: req.user.id
  });

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  await notification.markAsRead();

  res.json({
    success: true,
    message: 'Notification marked as read',
    data: notification
  });
}));

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    recipient: req.user.id
  });

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  await notification.remove();

  res.json({
    success: true,
    message: 'Notification deleted successfully'
  });
}));

// @desc    Get notification count (admin only)
// @route   GET /api/notifications/count
// @access  Private/Admin
router.get('/count', protect, checkPermission('view_analytics'), asyncHandler(async (req, res) => {
  const total = await Notification.countDocuments();
  const unread = await Notification.countDocuments({ read: false });
  const today = await Notification.countDocuments({
    createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
  });

  res.json({
    success: true,
    data: {
      total,
      unread,
      today
    }
  });
}));

// @desc    Create system notification (admin only)
// @route   POST /api/notifications/system
// @access  Private/Admin
router.post('/system', protect, checkPermission('manage_users'), asyncHandler(async (req, res) => {
  const {
    title,
    message,
    type,
    category,
    priority,
    recipients,
    actions,
    expiresAt
  } = req.body;

  // Get all admin users if no specific recipients
  let recipientIds = recipients;
  if (!recipientIds || recipientIds.length === 0) {
    const adminUsers = await User.find({ 
      role: { $in: ['admin', 'superadmin'] },
      isActive: true 
    }).select('_id');
    recipientIds = adminUsers.map(user => user._id);
  }

  const notificationData = {
    title,
    message,
    type: type || 'info',
    category: category || 'system',
    priority: priority || 'normal',
    actions: actions || [],
    expiresAt: expiresAt ? new Date(expiresAt) : null
  };

  const notifications = await Notification.createSystemNotification(recipientIds, notificationData);

  res.status(201).json({
    success: true,
    message: `System notification sent to ${notifications.length} recipients`,
    data: notifications
  });
}));

// @desc    Get notification statistics (admin only)
// @route   GET /api/notifications/stats
// @access  Private/Admin
router.get('/stats', protect, checkPermission('view_analytics'), asyncHandler(async (req, res) => {
  const total = await Notification.countDocuments();
  const unread = await Notification.countDocuments({ read: false });
  
  // Get notifications by type
  const byType = await Notification.aggregate([
    { $group: { _id: '$type', count: { $sum: 1 } } }
  ]);

  // Get notifications by category
  const byCategory = await Notification.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } }
  ]);

  // Get recent notifications (last 7 days)
  const last7Days = await Notification.aggregate([
    { 
      $match: { 
        createdAt: { $gte: new Date(Date.now() - 7*24*60*60*1000) } 
      } 
    },
    { 
      $group: { 
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, 
        count: { $sum: 1 } 
      } 
    },
    { $sort: { _id: 1 } }
  ]);

  res.json({
    success: true,
    data: {
      total,
      unread,
      byType,
      byCategory,
      last7Days
    }
  });
}));

// @desc    Delete expired notifications (admin only)
// @route   DELETE /api/notifications/expired
// @access  Private/Admin
router.delete('/expired', protect, checkPermission('manage_users'), asyncHandler(async (req, res) => {
  const result = await Notification.deleteMany({
    expiresAt: { $lt: new Date() }
  });

  res.json({
    success: true,
    message: `${result.deletedCount} expired notifications deleted`
  });
}));

module.exports = router; 