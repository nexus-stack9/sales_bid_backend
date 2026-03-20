const express = require('express');
const { requestVendorPasswordReset, verifyVendorOTPAndResetPassword, changeVendorPassword } = require('../controller/vendorPasswordResetController');
const { vendorAuth } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/request-reset', requestVendorPasswordReset);
router.post('/verify-reset', verifyVendorOTPAndResetPassword);
router.post('/change-password', vendorAuth, changeVendorPassword);

module.exports = router;
