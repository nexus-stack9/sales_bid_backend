const express = require('express');
const { requestPasswordReset, verifyOTPAndResetPassword } = require('../controller/passwordResetController');
const router = express.Router();

// Password reset routes
router.post('/request-reset', requestPasswordReset);
router.post('/verify-reset', verifyOTPAndResetPassword);

module.exports = router;