const db = require('../db/database');
const { sendEmail } = require('../services/emailService');
const { loadTemplate } = require('../utils/templateUtils');



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
    v.isactive AS vendor_active,

    -- Product counts
    COUNT(p.product_id) AS total,
    SUM(CASE WHEN p.isactive = true THEN 1 ELSE 0 END) AS active_products,
    SUM(CASE WHEN p.isactive = false OR p.isactive IS NULL THEN 1 ELSE 0 END) AS inactive_products

  FROM public.sb_vendors v
  LEFT JOIN public.products p 
    ON v.vendor_id = p.vendor_id
  WHERE v.isactive = true 
    AND v.approval_status = 'approved'
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
                aadhaar_number, account_holder_name, bank_account_number, bank_name, 
                ifsc_code, agree_terms, status, addressLine1, addressLine2, city, 
                state, postalCode, country, approval_status, isactive
            ) 
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
                $11, $12, $13, $14, $15, $16, $17, 
                $18, $19, $20, $21, $22, $23, $24, $25
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
            status,
            addressLine1,
            addressLine2,
            city,
            state,
            postalCode,
            country,
            approval_status,
            isactive
        ];

        const result = await db.query(query, values);
        const newSeller = result.rows[0];

        // Send verification email
        try {
            // Prepare replacement data for email template
            const replacements = {
                'Seller Name': name,
                'Seller Email': email,
                'Seller Image': '<div style="color: #9CA3AF; font-size: 14px; text-align: center; padding: 60px 20px; background: #F9FAFB; border-radius: 8px;">Image will be uploaded during verification</div>',
                'Estimated Time': '2-3 business days'
            };

            // Load and process the HTML template
            const htmlContent = loadTemplate('seller_verify_template.html', replacements);

            await sendEmail({
                to: email,
                subject: 'Seller Verification - Under Review',
                text: `Hello ${name}, Thank you for submitting your details to become a verified seller with SalesBid. Your application is currently under review.`,
                html: htmlContent
            });

            console.log(`Verification email sent to ${email}`);
        } catch (emailError) {
            console.error('Error sending verification email:', emailError);
            // Email failure doesn't fail the seller creation
        }

        return res.status(201).json({
            success: true,
            message: 'Seller created successfully. Verification email sent.',
            data: newSeller
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



  






    // Helper function to send approval email
 // Helper function to send approval email
sendApprovalEmail: async (seller, tempPassword) => {
    try {
        const replacements = {
            'Seller Name': seller.vendor_name || 'Valued Seller',
            'Seller Email': seller.email,
            'Password': tempPassword
        };

        const htmlContent = loadTemplate('seller_approved_template.html', replacements);

        await sendEmail({
            to: seller.email,
            subject: '🎉 Your SalesBid Seller Account is Approved!',
            text: `Congratulations ${seller.vendor_name}! Your seller account has been approved. Username: ${seller.email}, Temporary Password: ${tempPassword}. Please login and change your password.`,
            html: htmlContent
        });

        console.log(`✅ Approval email sent to ${seller.email}`);
        return true;
    } catch (error) {
        console.error('❌ Error sending approval email:', error);
        return false;
    }
},

// Helper function to send rejection email
 // Helper function to send rejection email
 sendRejectionEmail: async (seller, reason) => {
     try {
         const replacements = {
             'Seller Name': seller.vendor_name || 'Valued Seller',
             'Rejection Reason': reason || 'Your application does not meet our current seller requirements. Please review our guidelines and ensure all information provided is accurate and complete.'
         };

         const htmlContent = loadTemplate('seller_rejected_template.html', replacements);

         await sendEmail({
             to: seller.email,
             subject: 'SalesBid Seller Application Status Update',
             text: `Hello ${seller.vendor_name}, Unfortunately, we are unable to approve your seller application at this time. Reason: ${reason}`,
             html: htmlContent
         });

         console.log(`✅ Rejection email sent to ${seller.email}`);
         return true;
     } catch (error) {
         console.error('❌ Error sending rejection email:', error);
         return false;
     }
 },

// Main controller method
updateSellerStatus: async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rejectionReason } = req.body;
        
        // Validation
        if (!id || !status) {
            return res.status(400).json({
                success: false,
                message: 'Seller ID and status are required'
            });
        }
        
        const validStatuses = ['pending', 'approved', 'rejected', 'suspended'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status value. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        if (status === 'rejected' && !rejectionReason) {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason is required when rejecting a seller'
            });
        }
        
        // Get current seller details
        const sellerQuery = 'SELECT * FROM sb_vendors WHERE vendor_id = $1';
        const sellerResult = await db.query(sellerQuery, [id]);
        
        if (sellerResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Seller not found'
            });
        }
        
        const seller = sellerResult.rows[0];
        
        // Check if status is already the same
        if (seller.approval_status === status) {
            return res.status(400).json({
                success: false,
                message: `Seller status is already ${status}`
            });
        }
        
        let tempPassword = null;
        let hashedPassword = null;
        
        // Generate password only when approving
        if (status === 'approved') {
            tempPassword = generatePassword(12);
            hashedPassword = await bcrypt.hash(tempPassword, 10);
        }
        
        // Update seller status based on the new status
        let query, values;
        
        switch (status) {
            case 'approved':
                query = `
                    UPDATE sb_vendors 
                    SET approval_status = $1, 
                        status = 'active',
                        password = $2,
                        rejection_reason = NULL,
                        updated_at = NOW() 
                    WHERE vendor_id = $3
                    RETURNING *
                `;
                values = [status, hashedPassword, id];
                break;
                
            case 'rejected':
                query = `
                    UPDATE sb_vendors 
                    SET approval_status = $1,
                        status = 'inactive',
                        rejection_reason = $2,
                        updated_at = NOW() 
                    WHERE vendor_id = $3
                    RETURNING *
                `;
                values = [status, rejectionReason, id];
                break;
                
            case 'suspended':
                query = `
                    UPDATE sb_vendors 
                    SET approval_status = $1,
                        status = 'inactive',
                        updated_at = NOW() 
                    WHERE vendor_id = $2
                    RETURNING *
                `;
                values = [status, id];
                break;
                
            default: // pending
                query = `
                    UPDATE sb_vendors 
                    SET approval_status = $1,
                        updated_at = NOW() 
                    WHERE vendor_id = $2
                    RETURNING *
                `;
                values = [status, id];
        }
        
        const result = await db.query(query, values);
        const updatedSeller = result.rows[0];
        
        // Send appropriate email based on status
        let emailSent = false;
        
        if (status === 'approved') {
            emailSent = await sendApprovalEmail(seller, tempPassword);
        } else if (status === 'rejected') {
            emailSent = await sendRejectionEmail(seller, rejectionReason);
        }
        
        // Don't return sensitive data in response
        const responseData = { ...updatedSeller };
        delete responseData.password;
        delete responseData.aadhaar_number;
        delete responseData.pan_number;
        
        res.status(200).json({
            success: true,
            message: `Seller status updated to ${status} successfully${emailSent ? '. Notification email sent.' : ''}`,
            data: responseData,
            emailSent: emailSent
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