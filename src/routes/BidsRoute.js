const express = require('express');
const router = express.Router();
const { insertBid,getBidById, userBids } = require('../controller/BidController');

// Route to insert a new bid
router.post('/placeBid', insertBid);
router.get('/userBids/:bidder_id', userBids);getBidById
router.get('/getBidById/:bidder_id', getBidById);


module.exports = router;