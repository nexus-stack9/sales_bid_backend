const pool = require('../db/database');

/**
 * Get order details by order ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId) {
      return res.status(400).json({ 
        success: false,
        message: 'Order ID is required' 
      });
    }

    // Get order details
    const orderDetailsQuery = 'SELECT * FROM user_order_details WHERE order_id = $1';
    const orderDetailsResult = await pool.query(orderDetailsQuery, [orderId]);

    if (orderDetailsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No order details found for the specified order ID'
      });
    }

    res.status(200).json({
      success: true,
      data: orderDetailsResult.rows,
      count: orderDetailsResult.rowCount
    });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching order details',
      error: error.message
    });
  }
};

module.exports = {
  getOrderDetails
};
