const express = require('express');
const router = express.Router();
const { insertBid } = require('../controller/BidController');

// Route to insert a new bid
router.post('/placeBid', insertBid);

module.exports = router;