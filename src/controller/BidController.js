const db = require('../db/database');
const { RateLimiterMemory } = require('rate-limiter-flexible');

// Rate limiting setup: 10 requests per second per IP
const rateLimiter = new RateLimiterMemory({
  points: 10,
  duration: 1,
});

// Get all bids made by a specific user
const userBids = async (req, res) => {
  try {
    const { bidder_id } = req.params;

    if (!bidder_id) {
      return res.status(400).json({ error: 'bidder_id is required' });
    }

    const query = 'SELECT * FROM user_bids WHERE bidder_id = $1 ORDER BY bid_time DESC';
    const result = await db.query(query, [bidder_id]);

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching user bids:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Place a bid
const insertBid = async (req, res) => {
  try {
    // Rate limit per IP
    await rateLimiter.consume(req.ip);

    const { product_id, bidder_id, bid_amount, is_auto_bid = false } = req.body;

    // Validate input
    if (!product_id || !bidder_id || bid_amount === undefined || bid_amount === null) {
      return res.status(400).json({
        error: 'Missing required fields: product_id, bidder_id, and bid_amount',
        code: 'VALIDATION_ERROR',
      });
    }

    if (typeof bid_amount !== 'number' || isNaN(bid_amount) || bid_amount <= 0) {
      return res.status(400).json({
        error: 'bid_amount must be a positive number',
        code: 'INVALID_BID_AMOUNT',
      });
    }

    // Perform transactional logic
    const result = await db.transaction(async (client) => {
      // Lock current highest bid for the product
      const highestBidRes = await client.query(
        `SELECT bid_amount, bidder_id 
         FROM bids 
         WHERE product_id = $1 
         ORDER BY bid_amount DESC, bid_time DESC 
         LIMIT 1 FOR UPDATE`,
        [product_id]
      );

      const currentHighest = highestBidRes.rows[0];
      if (currentHighest && bid_amount <= currentHighest.bid_amount) {
        throw {
          status: 400,
          code: 'BID_TOO_LOW',
          message: `Bid amount must be higher than current highest: ${currentHighest.bid_amount}`,
        };
      }

      // Check for duplicate bid with same amount by the same user
      const duplicateRes = await client.query(
        `SELECT 1 FROM bids 
         WHERE product_id = $1 AND bidder_id = $2 AND bid_amount = $3`,
        [product_id, bidder_id, bid_amount]
      );

      if (duplicateRes.rows.length > 0) {
        throw {
          status: 409,
          code: 'DUPLICATE_BID',
          message: 'You have already placed this bid amount on this product',
        };
      }

      // Insert new bid (do not update previous bids to preserve history)
      const insertRes = await client.query(
        `INSERT INTO bids (product_id, bidder_id, bid_amount, is_auto_bid)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [product_id, bidder_id, bid_amount, is_auto_bid]
      );

      return insertRes.rows[0];
    });

    return res.status(201).json({
      ...result,
      message: 'Bid placed successfully',
      isNewBid: true,
    });
  } catch (error) {
    // Handle custom thrown errors
    if (error.status && error.code) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }

    console.error('Database error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  insertBid,
  userBids,
};
