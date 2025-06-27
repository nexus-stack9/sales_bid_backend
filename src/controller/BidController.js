const pool = require('../db/database');
const CryptoJS = require('crypto-js');
const multer = require('multer');
require('dotenv').config();

const userBids = async (req, res) => {
    try {
        const { bidder_id } = req.params;

        if (!bidder_id) {
            return res.status(400).json({ error: 'bidder_id is required' });
        }

        const query = 'SELECT * FROM user_bids WHERE bidder_id = $1';
        const result = await pool.query(query, [bidder_id]);
        
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching user bids:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const insertBid = async (req, res) => {
    try {
        const { product_id, bidder_id, bid_amount, is_auto_bid } = req.body;

        // Validate required fields
        if (!product_id || !bidder_id || !bid_amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const query = `
            INSERT INTO public.bids (product_id, bidder_id, bid_amount, is_auto_bid)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        
        const values = [product_id, bidder_id, bid_amount, is_auto_bid || false];
        
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        // Check for unique constraint violation
        if (error.code === '23505') {
            return res.status(400).json({ 
                error: 'Duplicate bid: A bid from this user for this product at this time already exists'
            });
        }
        // Check for foreign key violation
        if (error.code === '23503') {
            return res.status(400).json({ 
                error: 'Invalid product_id or bidder_id'
            });
        }
        console.error('Error inserting bid:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    insertBid,
    userBids
};

