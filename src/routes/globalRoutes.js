const express = require('express');
const router = express.Router();
const { 
  getAllRecords, 
  getRecordById, 
  insertRecord, 
  deleteRecord 
} = require('../controller/globalController');
// const authMiddleware = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
// router.use(authMiddleware);

// Get all records for a form
router.get('/getAllProducts', getAllRecords);

// Get a record by ID for a form
router.get('/getById/:id', getRecordById);

// Insert a new record for a form
router.post('/insert', insertRecord);

// Delete a record by ID for a form
router.post('/delete/:id', deleteRecord);

module.exports = router;