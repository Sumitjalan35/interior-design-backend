const express = require('express');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const { asyncHandler } = require('../middleware/errorHandler');
const { protect, admin } = require('../middleware/auth');
const Contact = require('../models/Contact');
const Notification = require('../models/Notification');
const User = require('../models/User');

const router = express.Router();

// Google Sheets API setup (optional)
let sheetsAuth = null;
try {
  sheetsAuth = new google.auth.GoogleAuth({
    keyFile: './google-credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
} catch (error) {
  console.log('⚠️ Google Sheets credentials not found or invalid');
}

// Email transporter setup (optional)
let transporter = null;
if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  try {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  } catch (error) {
    console.log('⚠️ Email configuration error:', error.message);
  }
}

// Spam detection function
const detectSpam = (contactData) => {
  let spamScore = 0;
  
  // Check for suspicious patterns
  const suspiciousWords = ['viagra', 'casino', 'loan', 'credit', 'free money', 'click here'];
  const message = contactData.message.toLowerCase();
  
  suspiciousWords.forEach(word => {
    if (message.includes(word)) spamScore += 2;
  });
  
  // Check for excessive caps
  const capsRatio = (contactData.message.match(/[A-Z]/g) || []).length / contactData.message.length;
  if (capsRatio > 0.7) spamScore += 3;
  
  // Check for suspicious email patterns
  if (contactData.email.includes('@temp') || contactData.email.includes('@test')) spamScore += 5;
  
  // Check for very short messages
  if (contactData.message.length < 10) spamScore += 2;
  
  return {
    isSpam: spamScore >= 5,
    spamScore
  };
};

// Add contact to Google Sheets (optional)
const addToGoogleSheets = async (contactData) => {
  if (!sheetsAuth || !process.env.GOOGLE_SHEET_ID) {
    console.log('⚠️ Google Sheets not configured, skipping...');
    return;
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth: sheetsAuth });
    
    const values = [
      [
        new Date().toISOString(),
        contactData.name,
        contactData.email,
        contactData.phone || 'N/A',
        contactData.service || 'N/A',
        contactData.budget || 'N/A',
        contactData.message,
        contactData.ipAddress,
        contactData.isSpam ? 'YES' : 'NO'
      ]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Sheet1!A:I',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: values,
      },
    });

    console.log('✅ Contact added to Google Sheets');
  } catch (error) {
    console.error('❌ Error adding to Google Sheets:', error.message);
    // Don't throw error, just log it
  }
};

// Send email notification (optional)
const sendEmailNotification = async (contactData) => {
  if (!transporter) {
    console.log('⚠️ Email not configured, skipping...');
    return;
  }

  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // Send to yourself
      subject: `New Contact Form Submission - ${contactData.name}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${contactData.name}</p>
        <p><strong>Email:</strong> ${contactData.email}</p>
        <p><strong>Phone:</strong> ${contactData.phone || 'Not provided'}</p>
        <p><strong>Service:</strong> ${contactData.service || 'Not specified'}</p>
        <p><strong>Budget:</strong> ${contactData.budget || 'Not specified'}</p>
        <p><strong>Message:</strong></p>
        <p>${contactData.message}</p>
        <hr>
        <p><small>Submitted at: ${new Date().toLocaleString()}</small></p>
        <p><small>IP Address: ${contactData.ipAddress}</small></p>
        ${contactData.isSpam ? '<p style="color: red;"><strong>⚠️ Potential Spam</strong></p>' : ''}
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Email notification sent');
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    // Don't throw error for email failures
  }
};

// @desc    Submit contact form
// @route   POST /api/contact
// @access  Public
router.post('/', asyncHandler(async (req, res) => {
  const { name, email, phone, service, budget, message } = req.body;

  // Validate required fields
  if (!name || !email || !message) {
    return res.status(400).json({
      success: false,
      message: 'Name, email, and message are required'
    });
  }

  // Get client info
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent');

  // Create contact object
  const contactData = {
    name,
    email,
    phone: phone || '',
    service: service || '',
    budget: budget || '',
    message,
    ipAddress,
    userAgent
  };

  // Detect spam
  const spamCheck = detectSpam(contactData);
  contactData.isSpam = spamCheck.isSpam;
  contactData.spamScore = spamCheck.spamScore;

  try {
    // Create contact in database
    const contact = new Contact(contactData);
    await contact.save();
    console.log('✅ Contact saved to database');

    // Add to Google Sheets (if not spam) - non-blocking
    if (!contactData.isSpam) {
      addToGoogleSheets(contactData).catch(error => {
        console.error('Google Sheets error (non-blocking):', error.message);
      });
    }

    // Send email notification - non-blocking
    sendEmailNotification(contactData).catch(error => {
      console.error('Email error (non-blocking):', error.message);
    });

    // Create notification for admins - non-blocking
    try {
      const adminUsers = await User.find({ 
        role: { $in: ['admin', 'superadmin'] },
        isActive: true 
      }).select('_id');

      if (adminUsers.length > 0) {
        await Notification.createSystemNotification(
          adminUsers.map(user => user._id),
          {
            title: 'New Contact Form Submission',
            message: `${name} submitted a contact form for ${service} project`,
            type: 'contact',
            category: 'contact',
            priority: 'high',
            relatedId: contact._id,
            relatedModel: 'Contact',
            actions: [
              {
                label: 'View Details',
                url: `/admin/contacts/${contact._id}`,
                action: 'view'
              }
            ]
          }
        );
        console.log('✅ Admin notification created');
      }
    } catch (error) {
      console.error('Notification creation failed:', error.message);
    }

    res.status(201).json({
      success: true,
      message: 'Thank you for your message! We\'ll get back to you soon.',
      data: {
        id: contact._id,
        submittedAt: contact.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Error saving contact:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit contact form. Please try again.'
    });
  }
}));

// @desc    Get all contacts (admin only)
// @route   GET /api/contact
// @access  Private/Admin
router.get('/', protect, admin, asyncHandler(async (req, res) => {
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

  // Decrypt sensitive data for admin view
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

// @desc    Get single contact (admin only)
// @route   GET /api/contact/:id
// @access  Private/Admin
router.get('/:id', protect, admin, asyncHandler(async (req, res) => {
  const contact = await Contact.findById(req.params.id);
  
  if (!contact) {
    return res.status(404).json({
      success: false,
      message: 'Contact not found'
    });
  }

  // Decrypt sensitive data
  const contactObj = contact.toObject();
  const decryptedData = contact.decryptSensitiveData();
  if (decryptedData) {
    contactObj.name = decryptedData.name;
    contactObj.email = decryptedData.email;
    contactObj.phone = decryptedData.phone;
    contactObj.message = decryptedData.message;
  }

  res.json({
    success: true,
    data: contactObj
  });
}));

// @desc    Update contact status (admin only)
// @route   PUT /api/contact/:id
// @access  Private/Admin
router.put('/:id', protect, admin, asyncHandler(async (req, res) => {
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

// @desc    Delete contact (admin only)
// @route   DELETE /api/contact/:id
// @access  Private/Admin
router.delete('/:id', protect, admin, asyncHandler(async (req, res) => {
  const contact = await Contact.findById(req.params.id);
  
  if (!contact) {
    return res.status(404).json({
      success: false,
      message: 'Contact not found'
    });
  }

  await contact.remove();

  res.json({
    success: true,
    message: 'Contact deleted successfully'
  });
}));

// @desc    Get contact statistics (admin only)
// @route   GET /api/contact/stats
// @access  Private/Admin
router.get('/stats/overview', protect, admin, asyncHandler(async (req, res) => {
  const total = await Contact.countDocuments();
  const newContacts = await Contact.countDocuments({ status: 'new' });
  const spamContacts = await Contact.countDocuments({ isSpam: true });
  const todayContacts = await Contact.countDocuments({
    createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
  });

  res.json({
    success: true,
    data: {
      total,
      new: newContacts,
      spam: spamContacts,
      today: todayContacts
    }
  });
}));

module.exports = router; 