const pool = require('../db/database');
const CryptoJS = require("crypto-js");
const { Parser } = require('json2csv'); // For CSV export - install: npm install json2csv
const ExcelJS = require('exceljs'); // For Excel export - install: npm install exceljs

function encryptPassword(password) {
  const secretKey = process.env.SECRET_KEY;
  if (!secretKey) {
    throw new Error('SECRET_KEY is not configured');
  }
  return CryptoJS.AES.encrypt(password, secretKey).toString();
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++PRODUCTS CONTROLLER+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
// Get all products by vendorId
const getAllProductsByVendorId = async (req, res) => {
  try {
    const { vendorId } = req.params;

    console.log("Fetching products for vendorId:", vendorId);

    // Step 1: Check if the vendor is admin
    const adminCheck = await pool.query(
      "SELECT is_admin FROM sb_vendors WHERE vendor_id = $1",
      [vendorId]
    );

    if (adminCheck.rows.length === 0) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    const isAdmin = adminCheck.rows[0].is_admin;
    console.log("Is Admin:", isAdmin);

    // Step 2: Build query based on admin status
    let queryText;
    let queryParams = [];

    if (isAdmin) {
      // Super admin -> get all products
      queryText = "SELECT * FROM vw_get_product_details";
    } else {
      // Regular vendor -> only their products
      queryText = "SELECT * FROM vw_get_product_details WHERE vendor_id = $1";
      queryParams = [vendorId];
    }

    const result = await pool.query(queryText, queryParams);
    console.log("Query result:", result.rows);

    // ✅ Always return 200 with array (empty or with data)
    res.status(200).json(result.rows);

  } catch (error) {
    console.error("Error fetching products by vendorId:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++VENDOR CONTROLLER+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

const getAllVendor = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vendor_product_stats');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const getVendorById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM sb_vendors WHERE vendor_id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const getVendorByStatus = async (req, res) => {
  try {
    const { status } = req.params;      
    const result = await pool.query(
      'SELECT * FROM sb_vendors WHERE approval_status = $1',
      [status]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateVendorActiveStatus = async (req, res) => {
  try {
    const { vendorId, status } = req.body;
    console.log(vendorId, status);
    const statusActive = status === true ? 'active' : 'inactive';
    
    const result = await pool.query(
      'UPDATE sb_vendors SET isactive = $1, status = $2 WHERE vendor_id = $3 RETURNING *',
      [status, statusActive, vendorId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateVendorStatus = async (req, res) => {
  try {
    const { vendorId, status, justification } = req.body;
    console.log(vendorId, status, justification);
    
    if (!vendorId || !status) {
      return res.status(400).json({ error: 'vendorId and status are required' });
    }

    const result = await pool.query(
      'UPDATE sb_vendors SET approval_status = $1, status_comment = $2, password = $3 WHERE vendor_id = $4 RETURNING *',
      [status, justification, encryptPassword('Password@' + vendorId.toString()), vendorId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const getAllmatrixByVendorId = async (req, res) => {
  try {
    const { vendorId } = req.params;

    console.log("Fetching products for vendorId:", vendorId);

    // Step 1: Check if the vendor is admin
    const adminCheck = await pool.query(
      "SELECT is_admin FROM sb_vendors WHERE vendor_id = $1",
      [vendorId]
    );

    if (adminCheck.rows.length === 0) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    const isAdmin = adminCheck.rows[0].is_admin;
    console.log("Is Admin:", isAdmin);

    // Step 2: Build query based on admin status
    let queryText;
    let queryParams = [];

    if (isAdmin) {
      queryText = "SELECT * FROM vendor_product_stats_total";
    } else {
      queryText = "SELECT * FROM vendor_product_stats WHERE vendor_id = $1";
      queryParams = [vendorId];
    }

    const result = await pool.query(queryText, queryParams);
    console.log("Query result:", result.rows);

    res.status(200).json(result.rows);

  } catch (error) {
    console.error("Error fetching products by vendorId:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++ORDER CONTROLLER+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

// Get all orders by vendorId with detailed information
const getAllOrderByVendorId = async (req, res) => {
  try {
    const { vendorId } = req.params;

    console.log("Fetching orders for vendorId:", vendorId);

    // Check if the vendor is admin
    const adminCheck = await pool.query(
      "SELECT is_admin FROM sb_vendors WHERE vendor_id = $1",
      [vendorId]
    );

    if (adminCheck.rows.length === 0) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    const isAdmin = adminCheck.rows[0].is_admin;
    console.log("Is Admin:", isAdmin);

    // Build query based on admin status with detailed information
    let queryText;
    let queryParams = [];

    if (isAdmin) {
      // Super admin -> get all orders with details
      queryText = `
        SELECT 
          o.*,
          p.name as product_name,
          p.image_path,
          p.category_id,
          p.quantity,
          pc.name as category,
          sv.vendor_name as seller_name,
          sv.pincode as seller_pincode,
          bu.first_name || ' ' || COALESCE(bu.last_name, '') as buyer_name,
          bu.email as buyer_email,
          bu.phone as buyer_phone,
          bu.address as buyer_address,
          bu.city as buyer_city,
          bu.state as buyer_state,
          bu.pincode as buyer_pincode,
          COALESCE(
            (SELECT jsonb_agg(
              jsonb_build_object(
                'bidder_id', b.bidder_id,
                'user_name', u.first_name,
                'bid_amount', b.bid_amount,
                'bid_time', b.bid_time
              )
            )
            FROM bids b
            LEFT JOIN users u ON b.bidder_id = u.user_id
            WHERE b.product_id = o.product_id
            ), '[]'::jsonb
          ) as bids
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.product_id
        LEFT JOIN product_categories pc ON p.category_id = pc.category_id
        LEFT JOIN sb_vendors sv ON o.seller_id = sv.vendor_id
        LEFT JOIN users bu ON o.buyer_id = bu.user_id
        ORDER BY o.order_date DESC
      `;
    } else {
      // Regular vendor -> only their orders with details
      queryText = `
        SELECT 
          o.*,
          p.name as product_name,
          p.image_path,
          p.category_id,
          p.quantity,
          pc.name as category,
          sv.vendor_name as seller_name,
          sv.pincode as seller_pincode,
          bu.first_name || ' ' || COALESCE(bu.last_name, '') as buyer_name,
          bu.email as buyer_email,
          bu.phone as buyer_phone,
          bu.address as buyer_address,
          bu.city as buyer_city,
          bu.state as buyer_state,
          bu.pincode as buyer_pincode,
          COALESCE(
            (SELECT jsonb_agg(
              jsonb_build_object(
                'bidder_id', b.bidder_id,
                'user_name', u.first_name,
                'bid_amount', b.bid_amount,
                'bid_time', b.bid_time
              )
            )
            FROM bids b
            LEFT JOIN users u ON b.bidder_id = u.user_id
            WHERE b.product_id = o.product_id
            ), '[]'::jsonb
          ) as bids
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.product_id
        LEFT JOIN product_categories pc ON p.category_id = pc.category_id
        LEFT JOIN sb_vendors sv ON o.seller_id = sv.vendor_id
        LEFT JOIN users bu ON o.buyer_id = bu.user_id
        WHERE o.seller_id = $1
        ORDER BY o.order_date DESC
      `;
      queryParams = [vendorId];
    }

    const result = await pool.query(queryText, queryParams);
    console.log("Query result count:", result.rows.length);

    res.status(200).json(result.rows);

  } catch (error) {
    console.error("Error fetching orders by vendorId:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get order statistics by vendorId
const getAllOrderMatrixByVendorId = async (req, res) => {
  try {
    const { vendorId } = req.params;

    console.log("Fetching order stats for vendorId:", vendorId);

    // Check if the vendor is admin
    const adminCheck = await pool.query(
      "SELECT is_admin FROM sb_vendors WHERE vendor_id = $1",
      [vendorId]
    );

    if (adminCheck.rows.length === 0) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    const isAdmin = adminCheck.rows[0].is_admin;
    console.log("Is Admin:", isAdmin);

    // Build query based on admin status
    let queryText;
    let queryParams = [];

    if (isAdmin) {
      // Super admin -> get all order stats
      queryText = `
        SELECT 
          NULL as seller_id,
          'All Vendors' as seller_name,
          COUNT(order_id) as total_orders,
          SUM(CASE WHEN order_status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
          SUM(CASE WHEN order_status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
          SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
          SUM(CASE WHEN order_status = 'shipped' THEN 1 ELSE 0 END) as shipped_orders,
          SUM(CASE WHEN order_status = 'processing' THEN 1 ELSE 0 END) as processing_orders,
          COALESCE(SUM(amount), 0) as total_order_value,
          COALESCE(AVG(amount), 0) as avg_order_value,
          COALESCE(MIN(amount), 0) as min_order_value,
          COALESCE(MAX(amount), 0) as max_order_value
        FROM orders
      `;
    } else {
      // Regular vendor -> only their order stats
      queryText = "SELECT * FROM order_stats WHERE seller_id = $1";
      queryParams = [vendorId];
    }

    const result = await pool.query(queryText, queryParams);
    console.log("Order stats result:", result.rows);

    res.status(200).json(result.rows);

  } catch (error) {
    console.error("Error fetching order stats by vendorId:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Update single order status
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;

    console.log("Updating order status:", orderId, status);

    if (!orderId || !status) {
      return res.status(400).json({ error: 'orderId and status are required' });
    }

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled', 'refunded'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const result = await pool.query(
      'UPDATE orders SET order_status = $1 WHERE order_id = $2 RETURNING *',
      [status, orderId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    console.log("Order updated successfully:", result.rows[0]);
    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      order: result.rows[0]
    });

  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Bulk update order status
const bulkUpdateOrderStatus = async (req, res) => {
  try {
    const { orderIds, status } = req.body;

    console.log("Bulk updating order status:", orderIds, status);

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ error: 'orderIds array is required' });
    }

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled', 'refunded'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const result = await pool.query(
      'UPDATE orders SET order_status = $1 WHERE order_id = ANY($2) RETURNING *',
      [status, orderIds]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'No orders found with the given IDs' });
    }

    console.log(`Bulk updated ${result.rowCount} orders`);
    res.status(200).json({
      success: true,
      message: `${result.rowCount} orders updated successfully`,
      updatedCount: result.rowCount,
      orders: result.rows
    });

  } catch (error) {
    console.error("Error bulk updating order status:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Export orders in various formats
const exportOrders = async (req, res) => {
  try {
    const { orderIds, format } = req.body;

    console.log("Exporting orders:", orderIds, format);

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ error: 'orderIds array is required' });
    }

    if (!format || !['csv', 'excel', 'json'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Supported: csv, excel, json' });
    }

    // Fetch order details
    const query = `
      SELECT 
        o.order_id,
        o.product_id,
        p.name as product_name,
        o.buyer_id,
        bu.first_name || ' ' || COALESCE(bu.last_name, '') as buyer_name,
        bu.email as buyer_email,
        bu.phone as buyer_phone,
        o.seller_id,
        sv.vendor_name as seller_name,
        o.order_status,
        o.order_date,
        o.amount,
        pc.name as category
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.product_id
      LEFT JOIN product_categories pc ON p.category_id = pc.category_id
      LEFT JOIN sb_vendors sv ON o.seller_id = sv.vendor_id
      LEFT JOIN users bu ON o.buyer_id = bu.user_id
      WHERE o.order_id = ANY($1)
      ORDER BY o.order_date DESC
    `;

    const result = await pool.query(query, [orderIds]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No orders found' });
    }

    const orders = result.rows;

    // Export based on format
    if (format === 'csv') {
      const fields = [
        'order_id',
        'product_name',
        'buyer_name',
        'buyer_email',
        'buyer_phone',
        'seller_name',
        'order_status',
        'order_date',
        'amount',
        'category'
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(orders);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=orders_${Date.now()}.csv`);
      res.status(200).send(csv);

    } else if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Orders');

      // Add headers
      worksheet.columns = [
        { header: 'Order ID', key: 'order_id', width: 15 },
        { header: 'Product Name', key: 'product_name', width: 30 },
        { header: 'Buyer Name', key: 'buyer_name', width: 25 },
        { header: 'Buyer Email', key: 'buyer_email', width: 30 },
        { header: 'Buyer Phone', key: 'buyer_phone', width: 15 },
        { header: 'Seller Name', key: 'seller_name', width: 25 },
        { header: 'Status', key: 'order_status', width: 15 },
        { header: 'Order Date', key: 'order_date', width: 20 },
        { header: 'Amount (₹)', key: 'amount', width: 15 },
        { header: 'Category', key: 'category', width: 20 }
      ];

      // Add rows
      orders.forEach(order => {
        worksheet.addRow(order);
      });

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=orders_${Date.now()}.xlsx`);

      await workbook.xlsx.write(res);
      res.end();

    } else if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=orders_${Date.now()}.json`);
      res.status(200).json(orders);
    }

  } catch (error) {
    console.error("Error exporting orders:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get single order details by order ID
const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log("Fetching order details for orderId:", orderId);

    const query = `
      SELECT 
        o.*,
        p.name as product_name,
        p.image_path,
        p.category_id,
        p.quantity,
        pc.name as category,
        sv.vendor_name as seller_name,
        sv.pincode as seller_pincode,
        bu.first_name || ' ' || COALESCE(bu.last_name, '') as buyer_name,
        bu.email as buyer_email,
        bu.phone as buyer_phone,
        bu.address as buyer_address,
        bu.city as buyer_city,
        bu.state as buyer_state,
        bu.pincode as buyer_pincode
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.product_id
      LEFT JOIN product_categories pc ON p.category_id = pc.category_id
      LEFT JOIN sb_vendors sv ON o.seller_id = sv.vendor_id
      LEFT JOIN users bu ON o.buyer_id = bu.user_id
      WHERE o.order_id = $1
    `;

    const result = await pool.query(query, [orderId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.status(200).json(result.rows[0]);

  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Delete order(s)
const deleteOrders = async (req, res) => {
  try {
    const { orderIds } = req.body;

    console.log("Deleting orders:", orderIds);

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ error: 'orderIds array is required' });
    }

    const result = await pool.query(
      'DELETE FROM orders WHERE order_id = ANY($1) RETURNING order_id',
      [orderIds]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'No orders found with the given IDs' });
    }

    console.log(`Deleted ${result.rowCount} orders`);
    res.status(200).json({
      success: true,
      message: `${result.rowCount} orders deleted successfully`,
      deletedCount: result.rowCount,
      deletedOrderIds: result.rows.map(row => row.order_id)
    });

  } catch (error) {
    console.error("Error deleting orders:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { 
  // Product Controllers
  getAllProductsByVendorId,
  
  // Vendor Controllers
  getAllVendor,
  getVendorByStatus,
  getVendorById,
  updateVendorStatus,
  updateVendorActiveStatus,
  getAllmatrixByVendorId,
  
  // Order Controllers
  getAllOrderByVendorId,
  getAllOrderMatrixByVendorId,
  updateOrderStatus,
  bulkUpdateOrderStatus,
  exportOrders,
  getOrderById,
  deleteOrders
};