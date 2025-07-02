const express = require('express');
const router = express.Router();
const { 
  getAllRecords, 
  getRecordById, 
  insertRecord, 
  deleteRecord ,
  updateRecord
} = require('../controller/globalController');
// const authMiddleware = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
// router.use(authMiddleware);

// Get all records for a form
router.get('/getAllRecords', getAllRecords);

// Get a record by ID for a form
router.get('/getById', getRecordById);

// Insert a new record for a form
router.post('/insert', insertRecord);

// Delete a record by ID for a form
router.delete('/delete', deleteRecord);

router.put('/update', updateRecord);

module.exports = router;