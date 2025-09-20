const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

const { getOrderDetails } = require("../controller/OrderController");


router.get('/details/:orderId', authMiddleware, getOrderDetails);

module.exports = router;