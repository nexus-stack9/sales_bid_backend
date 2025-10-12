const pool = require('../db/database')

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++PRODUCTS CONTROLLER+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
// Get all products by vendorId
const getAllProductsByVendorId = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const result = await pool.query(
      "SELECT * FROM vw_get_product_details1 WHERE vendor_id = $1",
      [vendorId]
    );

    if (result.rows.length === 0) {
      return res.status(204).send(); // No content
    }

    res.json(result.rows);
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

getVendorByStatus = async (req, res) => {
  try {
    const { status } = req.params;      
    const result = await pool.query(`SELECT * FROM sb_vendors WHERE approval_status = '${status}'`);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

updateVendorStatus = async (req, res) => {
  try {
    const { vendorId, status } = req.params;        
    const result = await pool.query(
      `UPDATE sb_vendors SET approval_status = $1 WHERE vendor_id = $2 RETURNING *`,
      [status, vendorId]
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

// Get all products by vendorId

module.exports = { getAllProductsByVendorId ,getAllVendor,getVendorByStatus,getVendorById,updateVendorStatus};