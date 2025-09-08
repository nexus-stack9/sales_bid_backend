const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadFileToR2, getFilesFromR2,mulUploadFilesToR2 } = require('../controller/fileController');
// const authMiddleware = require('../middleware/authMiddleware');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Route to upload a file to R2
router.post('/upload', upload.single('file'), uploadFileToR2);
router.post('/multiple-upload',  upload.array('files'),   // "files" must match formData.append('files', file)
  mulUploadFilesToR2 );

// Route to get all files from a specific folder in R2
router.post('/get', getFilesFromR2);

module.exports = router;