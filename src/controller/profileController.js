const pool = require('../db/database');
const CryptoJS = require('crypto-js');
const multer = require('multer');
require('dotenv').config();

/**
 * Update user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id; // Assuming user ID is available from authentication middleware
    
    // Extract data from request body or from multer parsed fields
    const firstName = req.body.firstName;
    const lastName = req.body.lastName;
    const email = req.body.email;
    const phone = req.body.phone;
    const address = req.body.address;
    
    // Handle profile picture from file upload if present
    let profilePicture = req.body.profilePicture;
    
    // If there's a file uploaded, use that instead
    if (req.file) {
      profilePicture = req.file.buffer.toString('base64');
    }

    // Check if email already exists for another user
    const emailCheckQuery = 'SELECT user_id FROM users WHERE email = $1 AND user_id != $2';
    const emailCheckResult = await pool.query(emailCheckQuery, [email, userId]);
    
    if (emailCheckResult.rows.length > 0) {
      return res.status(400).json({ message: 'Email already in use by another account' });
    }

    // Check if phone already exists for another user
    const phoneCheckQuery = 'SELECT user_id FROM users WHERE phone = $1 AND user_id != $2';
    const phoneCheckResult = await pool.query(phoneCheckQuery, [phone, userId]);
    
    if (phoneCheckResult.rows.length > 0) {
      return res.status(400).json({ message: 'Phone number already in use by another account' });
    }

    // Update user profile
    let updateQuery = `
      UPDATE users 
      SET first_name = $1, last_name = $2, email = $3, phone = $4
    `;
    
    let values = [firstName, lastName, email, phone];
    let paramCount = 4;
    
    // If profile picture is provided, include it in the update
    if (profilePicture) {
      paramCount++;
      updateQuery += `, profile_picture = $${paramCount}`;
      values.push(profilePicture);
    }
    
    // Complete the query
    updateQuery += ` WHERE user_id = $${paramCount + 1} RETURNING user_id, first_name, last_name, email, phone, role, profile_picture`;
    values.push(userId);
    
    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return updated user data (don't send the full profile picture in response)
    const userData = { ...result.rows[0] };
    if (userData.profile_picture) {
      userData.profile_picture = true; // Just indicate that a profile picture exists
    }

    return res.status(200).json({
      message: 'Profile updated successfully',
      user: userData
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Update user password
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updatePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Get user's current password hash from database
    const getUserQuery = 'SELECT password_hash FROM users WHERE user_id = $1';
    const userResult = await pool.query(getUserQuery, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const storedPasswordHash = userResult.rows[0].password_hash;

    // Decrypt both passwords using the same method as in loginController
    const decryptedStoredPassword = decryptPassword(storedPasswordHash);
    const decryptedCurrentPassword = decryptPassword(currentPassword);

    // Verify current password
    const isPasswordValid = decryptedStoredPassword === decryptedCurrentPassword;
    
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update password in database (store as is, since it's already encrypted)
    const updatePasswordQuery = 'UPDATE users SET password_hash = $1 WHERE user_id = $2';
    await pool.query(updatePasswordQuery, [newPassword, userId]);

    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get user profile details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getProfileDetails = async (req, res) => {
  try {
    // Get user ID from route parameters
    const userId = req.params.id;

    // Query the view to get profile details for the specified user
    const query = 'SELECT * FROM vw_profile_details WHERE user_id = $1';
    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    // Process the results to create a structured response
    const profileData = result.rows[0];
    
    // Extract base user data
    const userData = {
      userId: profileData.user_id,
      firstName: profileData.first_name,
      lastName: profileData.last_name,
      email: profileData.email,
      phone: profileData.phone,
      role: profileData.role,
      profilePicture: profileData.profile_picture,
      isActive: profileData.is_active,
      createdAt: profileData.created_at
    };

    // Extract address data if available
    const addressData = profileData.address_id ? {
      addressId: profileData.address_id,
      label: profileData.label,
      street: profileData.street,
      city: profileData.city,
      state: profileData.state,
      postalCode: profileData.postal_code,
      country: profileData.country,
      isPrimary: profileData.is_primary
    } : null;

    // Extract payment method data if available
    const paymentData = profileData.card_number ? {
      cardNumber: profileData.card_number,
      expiryDate: profileData.expiry_date
    } : null;

    // Combine all data into a single response object
    const profileDetails = {
      user: userData,
      address: addressData,
      paymentMethod: paymentData
    };

    return res.status(200).json({
      message: 'Profile details retrieved successfully',
      profile: profileDetails
    });
  } catch (error) {
    console.error('Error retrieving profile details:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Decrypt password using CryptoJS
 * @param {string} encryptedPassword - Encrypted password
 * @returns {string} Decrypted password
 */
function decryptPassword(encryptedPassword) {
  const secretKey = process.env.SECRET_KEY;
  const bytes = CryptoJS.AES.decrypt(encryptedPassword, secretKey);
  return bytes.toString(CryptoJS.enc.Utf8);
}

const getUserCounts = async (req, res) => {
  try {
      const { user_id } = req.params;
      
      if (!user_id) {
          return res.status(400).json({
              success: false,
              message: 'User ID is required'
          });
      }

      const query = `
      SELECT
        COUNT(w.product_id) AS wishlist_count,
        (
          SELECT COUNT(DISTINCT b.product_id)
          FROM bids b
          WHERE b.bidder_id = $1
        ) AS bids_count
      FROM wishlist w
      WHERE w.user_id = $1;
      `;

      const result = await pool.query(query, [user_id]);

      if (result.rows.length === 0) {
          return res.status(200).json({
              success: true,
              data: {
                  wishlist_count: 0,
                  bids_count: 0
              }
          });
      }

      res.status(200).json({
          success: true,
          data: result.rows[0]
      });

  } catch (error) {
      console.error('Error fetching user counts:', error);
      res.status(500).json({
          success: false,
          message: 'Failed to fetch user counts',
          error: error.message
      });
  }
};

/**
 * Get user orders
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserOrders = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: 'User ID is required' 
      });
    }

    // Get all orders for the user
    const ordersQuery = 'SELECT * FROM user_orders WHERE user_id = $1 ORDER BY order_date DESC';
    const ordersResult = await pool.query(ordersQuery, [userId]);

    res.status(200).json({
      success: true,
      data: ordersResult.rows,
      count: ordersResult.rowCount
    });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user orders',
      error: error.message
    });
  }
};

module.exports = {
  updateProfile,
  updatePassword,
  getProfileDetails,
  getUserCounts,
  getUserOrders
};