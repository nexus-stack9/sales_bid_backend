const express = require('express');
const { registerUser, signin, loginWithGoogle, vendorSignin } = require('../controller/loginController');
const router = express.Router();

// Register route
router.post('/register', registerUser);
router.post('/login', signin)
router.post('/vendorLogin', vendorSignin)
router.post('/login/google', loginWithGoogle)

module.exports = router;
