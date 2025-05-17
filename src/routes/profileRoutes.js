const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const multer = require('multer');
const { updateProfile, updatePassword, getProfileDetails } = require('../controller/profileController');
const authMiddleware = require('../middleware/authMiddleware');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Validation rules for profile update
const profileValidation = [
  check('firstName', 'First name is required').not().isEmpty(),
  check('lastName', 'Last name is required').not().isEmpty(),
  check('email', 'Please include a valid email').isEmail(),
  check('phone', 'Please include a valid phone number').not().isEmpty()
];

// Validation rules for password update
const passwordValidation = [
  check('currentPassword', 'Current password is required').not().isEmpty(),
  check('newPassword', 'New password must be at least 6 characters').isLength({ min: 6 })
];

// Route to get user profile details by ID
router.get('/details/:id', authMiddleware, getProfileDetails);

// Route to update user profile - handles both JSON and FormData
router.put('/update', authMiddleware, upload.single('profilePicture'), profileValidation, updateProfile);

// Route to update user password
router.put('/update-password', authMiddleware, passwordValidation, updatePassword);

module.exports = router;