const db = require('../db/database');

const sellerController = {
    // Get all sellers
    getAllSellers: async (req, res) => {
        try {
            const query = `
               SELECT 
    v.vendor_id,
    v.vendor_name,
    v.email,
    v.phone_number,
    v.business_name,
    v.business_type,
    v.profile_picture,
    v.approval_status,
    v.isactive as vendor_active,
    
    -- Product counts
    COUNT(p.product_id) as total,
    SUM(CASE WHEN p.isactive = true THEN 1 ELSE 0 END) as active_products,
    SUM(CASE WHEN p.isactive = false OR p.isactive IS NULL THEN 1 ELSE 0 END) as inactive_products
    
FROM public.sb_vendors v where v.isactive = true and v.approval_status = 'approved'
LEFT JOIN public.products p ON v.vendor_id = p.vendor_id
GROUP BY 
    v.vendor_id, 
    v.vendor_name, 
    v.email, 
    v.phone_number, 
    v.business_name, 
    v.business_type, 
    v.profile_picture,
    v.approval_status,
    v.isactive
ORDER BY v.vendor_id;
            `;
            
            const result = await db.query(query);
            
            res.status(200).json({
                success: true,
                count: result.rows.length,
                data: result.rows
            });
        } catch (error) {
            console.error('Error fetching sellers:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch sellers',
                error: error.message
            });
        }
    },

    // Get seller by ID
    getSellerById: async (req, res) => {
        try {
            const { id } = req.params;
            
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'Seller ID is required'
                });
            }
            
            // Get seller basic info
            const sellerQuery = 'SELECT * FROM sb_vendors WHERE vendor_id = $1';
            const sellerResult = await db.query(sellerQuery, [id]);
            
            if (!sellerResult.rows || sellerResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Seller not found'
                });
            }
            
            // Get seller's products stats
            const statsQuery = `
                SELECT 
                    COUNT(*) AS total_products,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_products,
                    SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) AS sold_products,
                    SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft_products
                FROM products 
                WHERE vendor_id = $1
            `;
            const statsResult = await db.query(statsQuery, [id]);
            
            // Get recent products
            const productsQuery = `
                SELECT product_id, name, starting_price, status, auction_end 
                FROM products 
                WHERE vendor_id = $1
                ORDER BY created_at DESC
                LIMIT 5
            `;
            const productsResult = await db.query(productsQuery, [id]);
            
            // Combine all data
            const sellerData = {
                ...sellerResult.rows[0],
                stats: statsResult.rows[0],
                recent_products: productsResult.rows
            };
            
            res.status(200).json({
                success: true,
                data: sellerData
            });
            
        } catch (error) {
            console.error('Error fetching seller by ID:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch seller',
                error: error.message
            });
        }
    },

    // Create a new seller
 createSeller: async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            dob,
            businessType: business_type,
            businessName: business_name,
            gstNumber: gst_number,
            itemsCategory: items_category,
            businessDescription: business_description,
            panNumber: pan_number,
            aadhaarNumber: aadhaar_number,
            accountHolderName: account_holder_name,
            accountNumber: bank_account_number,
            bankName: bank_name,
            ifscCode: ifsc_code,
            agreeTerms,
            addressLine1,
            addressLine2,
            city,
            state,
            postalCode,
            country,
            approval_status = 'pending',
            isactive = true,
            status = 'pending'
        } = req.body;


        // Validate required fields
        if (!name || !email || !phone || !agreeTerms) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, phone, and agreeTerms are required fields'
            });
        }

        // Check if email already exists
        const emailCheck = await db.query('SELECT vendor_id FROM sb_vendors WHERE email = $1', [email]);
        if (emailCheck.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Insert the new seller
        const query = `
  INSERT INTO sb_vendors (
    vendor_name, email, phone_number, dob, business_type, business_name,
    gst_number, items_category, business_description, pan_number, 
    aadhaar_number,
    account_holder_name, bank_account_number, bank_name, ifsc_code, agree_terms, status,
    addressLine1, addressLine2, city, state, postalCode, country, approval_status, isactive
  ) 
  VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
    $11, $12, $13, $14, $15, $16, $17, 
    $18, $19, $20, $21, $22, $23, $24
  )
  RETURNING *;
`;


        const values = [
            name,
            email,
            phone,
            dob || null,
            business_type,
            business_name || null,
            gst_number || null,
            items_category || null,
            business_description || null,
            pan_number || null,
            aadhaar_number || null,
            account_holder_name || null,
            bank_account_number || null,
            bank_name || null,
            ifsc_code || null,
            agreeTerms,
            addressLine1,
            addressLine2,
            city,
            state,
            postalCode,
            country,
            status,
            approval_status,
            isactive
        ];

        const result = await db.query(query, values);

        return res.status(201).json({
            success: true,
            message: 'Seller created successfully',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Error creating seller:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create seller',
            error: error.message
        });
    }
},

    // Update seller status
    updateSellerStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;
            
            if (!id || !status) {
                return res.status(400).json({
                    success: false,
                    message: 'Seller ID and status are required'
                });
            }
            
            if (!['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status value'
                });
            }
            
            const query = `
                UPDATE sellers 
                SET status = $1, updated_at = NOW() 
                WHERE id = $2
                RETURNING *
            `;
            
            const result = await db.query(query, [status, id]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Seller not found'
                });
            }
            
            res.status(200).json({
                success: true,
                message: 'Seller status updated successfully',
                data: result.rows[0]
            });
            
        } catch (error) {
            console.error('Error updating seller status:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update seller status',
                error: error.message
            });
        }
    },

    

    // Delete a seller (soft delete)
    deleteSeller: async (req, res) => {
        try {
            const { id } = req.params;
            
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'Seller ID is required'
                });
            }
            
            // First check if seller has active products
            const activeProducts = await db.query(
                'SELECT COUNT(*) FROM products WHERE vendor_id = $1 AND status = $2',
                [id, 'active']
            );
            
            if (activeProducts.rows[0].count > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete seller with active products'
                });
            }
            
            // Soft delete the seller
            const query = `
                UPDATE sellers 
                SET status = 'deleted', deleted_at = NOW() 
                WHERE id = $1
                RETURNING *
            `;
            
            const result = await db.query(query, [id]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Seller not found'
                });
            }
            
            res.status(200).json({
                success: true,
                message: 'Seller deleted successfully',
                data: result.rows[0]
            });
            
        } catch (error) {
            console.error('Error deleting seller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete seller',
                error: error.message
            });
        }
    },


   updateSellerPath: async (req, res) => {
  try {
    const { 
      vendor_id,
      pan_card_path,
      aadhaar_front_path,
      aadhaar_back_path,
      bank_proof_path,
      profile_picture,
    } = req.body;

    const query = `
      UPDATE public.sb_vendors
      SET pan_card_path=$2, aadhaar_front_path=$3, aadhaar_back_path=$4, bank_proof_path=$5, profile_picture=$6
      WHERE vendor_id=$1
      RETURNING *;
    `;

    const values = [
      vendor_id,
      pan_card_path || null,
      aadhaar_front_path || null,
      aadhaar_back_path || null,
      bank_proof_path || null,
      profile_picture || null,
    ];

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Seller updated successfully',
      data: result.rows[0],
    });

  } catch (error) {
    console.error('Error updating seller:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update seller',
      error: error.message,
    });
  }
},

};





module.exports = sellerController;