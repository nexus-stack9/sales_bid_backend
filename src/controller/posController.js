const pool = require('../db/database')

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++PRODUCTS CONTROLLER+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
// Get all products by vendorId
const getAllProductsByVendorId = async (req, res) => {
  try {
    const { vendorId } = req.params;
    
    console.log("Fetching products for vendorId:", vendorId); // DEBUG
    
    const result = await pool.query(
      "SELECT * FROM vw_get_product_details1 WHERE vendor_id = $1",
      [vendorId]
    );

    console.log("Query result:", result.rows); // DEBUG

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
    const result = await pool.query('SELECT * FROM sb_vendors');
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

// FIXED: Added 'const' keyword and fixed SQL injection vulnerability
const getVendorByStatus = async (req, res) => {
  try {
    const { status } = req.params;      
    // FIXED: Use parameterized query to prevent SQL injection
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

// FIXED: Added 'const' keyword
const updateVendorStatus = async (req, res) => {
  try {
    const { vendorId, status,jusification } = req.params;        
    const result = await pool.query(
      'UPDATE sb_vendors SET approval_status = $1 , status_comment = $2 WHERE vendor_id = $3 RETURNING *',
      [status, jusification,vendorId]
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

module.exports = { 
  getAllProductsByVendorId,
  getAllVendor,
  getVendorByStatus,
  getVendorById,
  updateVendorStatus
};