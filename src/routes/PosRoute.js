const express  = require('express');
const router = express.Router();



const { getAllProductsByVendorId,getAllVendor,getVendorByStatus,getVendorById,updateVendorStatus } = require('../controller/posController');

// Route to get all products by vendor ID
router.get('/getAllProductsByVendorId/:vendorId', getAllProductsByVendorId);
router.get('/getAllVendor', getAllVendor);
router.get('/getVendorByStatus/:status', getVendorByStatus);
router.get('/getVendorById/:vendorId', getVendorById);
router.put('/updateVendorStatus/:vendorId/status/:status/jusification/:jusification', updateVendorStatus);

module.exports = router;