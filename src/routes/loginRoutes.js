const express = require('express');
const { registerUser, signin, loginWithGoogle, vendorSignin, sendLoginOtp, verifyLoginOtp, sendRegistrationOtp, verifyRegistrationOtp } = require('../controller/loginController');
const router = express.Router();

// Register route
router.post('/register', registerUser);
router.post('/login', signin)
router.post('/vendorLogin', vendorSignin)
router.post('/login/google', loginWithGoogle)
router.post('/send-otp', sendLoginOtp);
router.post('/verify-otp', verifyLoginOtp);
router.post('/send-registration-otp', sendRegistrationOtp);
router.post('/verify-registration-otp', verifyRegistrationOtp);

module.exports = router;
