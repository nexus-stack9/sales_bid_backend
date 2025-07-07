const express = require('express');
const router = express.Router();
const { getVendors } = require('../controller/VendorController');

// Route to insert a new bid
router.get('/vendors', getVendors);

module.exports = router;