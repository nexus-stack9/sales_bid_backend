const express = require('express');
const router = express.Router();
const addressController = require('../controller/addressController');

// Handle address POST requests
// router.post('/address', addressController.handleAddress);

// Add address
router.post('/addAddress', addressController.addAddress);

// Get all addresses by user id
router.get('/address/:id', addressController.getAddressesById);

// Edit address by id
router.put('/editAddress/:id', addressController.editAddress);

// Delete address by id
router.delete('/deleteAddress/:id', addressController.deleteAddress);

module.exports = router;
