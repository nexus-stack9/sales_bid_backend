const express = require('express');
const router = express.Router();
const { insertBid, userBids } = require('../controller/BidController');

// Route to insert a new bid
router.post('/placeBid', insertBid);
router.get('/userBids/:bidder_id', userBids);

module.exports = router;