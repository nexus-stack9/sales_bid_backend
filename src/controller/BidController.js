const db = require('../db/database');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const { sendEmail } = require('../services/emailService');
const { loadTemplate } = require('../utils/templateUtils');
const path = require('path');

// Async function to send bid confirmation email
const sendBidConfirmationEmail = async (bidder_id, product_id, bid_amount) => {
  try {
    // Get user and product details for email notification
    const userQuery = `
      SELECT u.email, u.first_name, u.last_name,
             p.name as product_name, p.description, p.starting_price, p.auction_end,
             p.image_path, p.retail_value, p.location, p.shipping, p.quantity
      FROM users u
      CROSS JOIN products p
      WHERE u.user_id = $1 AND p.product_id = $2
    `;
    
    const { rows: [bidDetails] } = await db.query(userQuery, [bidder_id, product_id]);

    if (!bidDetails) return;

    // Format the bid amount and other currency values
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2
      }).format(amount);
    };

    const formattedBid = formatCurrency(bid_amount);
    const formattedMsrp = formatCurrency(bidDetails.retail_value);
    const formattedStartPrice = formatCurrency(bidDetails.starting_price);
    
    // Format auction end date
    const auctionEndDate = new Date(bidDetails.auction_end).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    // Get the first image URL from the comma-separated image_path and create an img tag
    let productImage = '';
    if (bidDetails.image_path) {
      const firstImageUrl = bidDetails.image_path.split(',')[0].trim();
      productImage = `<img src="${firstImageUrl}" alt="${bidDetails.product_name}" style="max-width: 100%; max-height: 200px; object-fit: contain; border: none; display: block; margin: 0 auto;">`;
    }

    // Prepare template replacements
    const replacements = {
      'User Name': `${bidDetails.first_name} ${bidDetails.last_name}`,
      'Product Name': bidDetails.product_name,
      'Product Description': bidDetails.description || 'No description available',
      'Bid Amount': formattedBid,
      'MSRP': formattedMsrp,
      'Starting Price': formattedStartPrice,
      'Auction End Date': auctionEndDate,
      'Location': bidDetails.location || 'Not specified',
      'Shipping': bidDetails.shipping || 'To be determined',
      'Quantity': bidDetails.quantity || 1,
      'Product Image': productImage
    };

    // Load and process the HTML template
    const htmlContent = loadTemplate('bid_placed_template.html', replacements);

    // Create plain text version
    const textContent = `
      Your Bid Has Been Placed Successfully!
      
      Hello ${bidDetails.first_name} ${bidDetails.last_name},
      
      Thank you for placing your bid of ${formattedBid} on ${bidDetails.product_name}.
      
      Product: ${bidDetails.product_name}
      Description: ${bidDetails.description || 'No description available'}
      Your Bid: ${formattedBid}
      Starting Price: ${formattedStartPrice}
      MSRP: ${formattedMsrp}
      Auction Ends: ${auctionEndDate}
      
      We'll notify you if you're outbid or when the auction ends.
      
      Thank you for using SalesBid!
    `;

    // Send email notification
    await sendEmail({
      to: bidDetails.email,
      subject: `Your Bid of ${formattedBid} Has Been Placed Successfully`,
      html: htmlContent,
      text: textContent
    });
  } catch (error) {
    console.error('Error sending bid confirmation email:', error);
    // Don't throw, we don't want to fail the request if email fails
  }
};

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

// Function to send outbid notifications to other bidders
const sendOutbidNotifications = async (product_id, current_bidder_id, bid_amount) => {
  try {
    // Get all other bidders for this product
    const outbidBidders = await db.query(
      `SELECT bidder_id, first_name, email, phone, product_id, max_bid_amount as max_bid
       FROM public.max_product_bids 
       WHERE product_id = $1 AND bidder_id != $2 AND max_bid_amount < $3`,
      [product_id, current_bidder_id, bid_amount]
    );

    if (outbidBidders.rows.length === 0) return;

    // Get product details for the email
    const productRes = await db.query(
      `SELECT p.name, p.description, p.auction_end, p.image_path,
              (SELECT MAX(bid_amount) FROM bids WHERE product_id = $1) as current_highest_bid
       FROM products p 
       WHERE p.product_id = $1`,
      [product_id]
    );

    if (productRes.rows.length === 0) return;
    
    const product = productRes.rows[0];
    const auctionEndDate = new Date(product.auction_end).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    // Format currency
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2
      }).format(amount);
    };

    // Process each outbid user
    for (const bidder of outbidBidders.rows) {
      try {
        // Get first image URL if available
        let productImage = '';
        if (product.image_path) {
          const firstImageUrl = product.image_path.split(',')[0].trim();
          productImage = `<img src="${firstImageUrl}" alt="${product.name}" style="max-width: 100%; max-height: 200px; object-fit: contain; border: none; display: block; margin: 0 auto;">`;
        }

        const domain = process.env.DOMAIN_URL || 'http://localhost:8080';
        const replacements = {
          'User Name': bidder.first_name,
          'Product Name': product.name,
          'Product Description': product.description || 'No description available',
          'Bid Amount': formatCurrency(bidder.max_bid),
          'Current Highest Bid': formatCurrency(product.current_highest_bid || 0),
          'Auction End Date': auctionEndDate,
          'Product Image': productImage,
          'AUCTION_URL': `${domain}/auctions/${product_id}`
        };

        // Load and process the HTML template
        const htmlContent = loadTemplate('out-bid-template.html', replacements);

        // Create plain text version
        const textContent = `You've been outbid on ${product.name}!

Hello ${bidder.first_name},

We're sorry to inform you that your bid of ${formatCurrency(bidder.max_bid)} on ${product.name} has been outbid.

Current highest bid: ${formatCurrency(product.current_highest_bid || 0)}
Auction ends: ${auctionEndDate}

Don't give up yet! You can still place a new bid to win this item.`;

        // Send email notification
        await sendEmail({
          to: bidder.email,
          subject: `You've been outbid on ${product.name}`,
          html: htmlContent,
          text: textContent
        });

      } catch (error) {
        console.error(`Error sending outbid notification to ${bidder.email}:`, error);
        // Continue with other bidders if one fails
      }
    }
  } catch (error) {
    console.error('Error in sendOutbidNotifications:', error);
    // Don't throw, we don't want to fail the main request if notifications fail
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

    // Start email sending in the background without awaiting
    Promise.all([
      sendBidConfirmationEmail(bidder_id, product_id, bid_amount),
      sendOutbidNotifications(product_id, bidder_id, bid_amount)
    ]).catch(error => {
      console.error('Background email sending failed:', error);
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
