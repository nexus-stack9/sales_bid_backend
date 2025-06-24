const db = require('../db/database');

const addWishlistItem = async (req, res) => {
    try {
        const { product_id, bidder_id} = req.body;

        // Validate required fields
        if (!product_id || !bidder_id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const query = `
            INSERT INTO wishlist (product_id, user_id)
            VALUES ($1, $2)
            RETURNING *
        `;
        
        const values = [product_id, bidder_id];
        
        const result = await db.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        // Check for unique constraint violation
        if (error.code === '23505') {
            return res.status(400).json({ 
                error: 'Duplicate record: A record from this user for this product at this time already exists'
            });
        }
        // Check for foreign key violation
        if (error.code === '23503') {
            return res.status(400).json({ 
                error: 'Invalid product_id or bidder_id'
            });
        }
        console.error('Error inserting wishlist item:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const deleteWishlistItem = async (req, res) => {
    try {
        const { product_id, bidder_id } = req.body;

        // Validate required fields
        if (!product_id || !bidder_id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const query = `
            DELETE FROM wishlist 
            WHERE product_id = $1 AND user_id = $2
            RETURNING *
        `;
        
        const values = [product_id, bidder_id];
        
        const result = await db.query(query, values);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Wishlist item not found' });
        }
        
        res.status(200).json({ message: 'Wishlist item removed successfully', deletedItem: result.rows[0] });
    } catch (error) {
        console.error('Error deleting wishlist item:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const checkWishlistItem = async (req, res) => {
    try {
        const { product_id, bidder_id } = req.body;

        // Validate required fields
        if (!product_id || !bidder_id) {
            return res.status(400).json({ error: 'Missing required query parameters: product_id and bidder_id' });
        }

        const query = `
            SELECT * FROM wishlist 
            WHERE product_id = $1 AND user_id = $2
        `;
        
        const values = [product_id, bidder_id];
        
        const result = await db.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(200).json({ exists: false, item: null });
        }
        
        res.status(200).json({ exists: true, item: result.rows[0] });
    } catch (error) {
        console.error('Error checking wishlist item:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

   // Get wishlist by user ID
   const getWishlistByUserId = async (req, res) => {
    try {
        const { user_id } = req.params;
        
        if (!user_id) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }
        
        // Get wishlist with product details
        const query = `
            SELECT w.*, p.* 
            FROM wishlist w
            JOIN vw_get_product_details p ON w.product_id = p.product_id
            WHERE w.user_id = $1
            ORDER BY w.created_date_time DESC
        `;
        const result = await db.query(query, [user_id]);
        
        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch wishlist',
            error: error.message
        });
    }
};

module.exports = {
    addWishlistItem,
    deleteWishlistItem,
    checkWishlistItem,
    getWishlistByUserId
};
