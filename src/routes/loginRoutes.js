const express = require('express');
const { registerUser, signin } = require('../controller/loginController');
const router = express.Router();

// Register route
router.post('/register', registerUser);
router.post('/login', signin)

module.exports = router;
