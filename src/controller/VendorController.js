const pool = require('../db/database');

/**
 * @route GET /api/vendors
 * @description Get all vendor names
 * @access Public
 */
const getVendors = async (req, res) => {
    try {
        const query = 'SELECT vendor_name FROM sb_vendors';
        const result = await pool.query(query);
        
        // Extract vendor names from the result
        const vendors = result.rows.map(row => row.vendor_name);
        
        res.status(200).json({
            success: true,
            count: vendors.length,
            data: vendors
        });
    } catch (error) {
        console.error('Error fetching vendors:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch vendors',
            details: error.message
        });
    }
};

module.exports = {
    getVendors
};