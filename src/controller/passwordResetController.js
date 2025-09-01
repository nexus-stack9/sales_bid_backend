const fs = require('fs');
const path = require('path');
const db = require('../db/database');
const { sendEmail } = require('../services/emailService');
const CryptoJS = require('crypto-js');
require('dotenv').config();

/**
 * Generate a random 6-digit OTP
 * @returns {string} 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Request password reset
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const requestPasswordReset = async (req, res) => {
  const { contact } = req.body;

  if (!contact) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    // Check if user exists
    const userResult = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [contact]
    );

    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 10); // OTP valid for 10 minutes

    // Encrypt OTP before storing
    const encryptedOTP = CryptoJS.AES.encrypt(
      otp,
      process.env.SECRET_KEY
    ).toString();

    // Store OTP in database
    await db.query(
      `INSERT INTO otp_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) 
       DO UPDATE SET token = $2, expires_at = $3, created_at = NOW()`,
      [user.user_id, encryptedOTP, expiryTime]
    );

    // Read email template
    const templatePath = path.join(__dirname, '../templates/otp-email-template.html');
    let emailTemplate = fs.readFileSync(templatePath, 'utf8');

    // Replace OTP in template
    emailTemplate = emailTemplate.replace('123456', otp);

    // Send email with OTP
    await sendEmail({
      to: contact,
      subject: 'Password Reset Code',
      text: `Your password reset code is: ${otp}. This code is valid for 10 minutes.`,
      html: emailTemplate
    });

    res.status(200).json({
      message: 'Password reset code sent to your email.',
      expiresIn: '10 minutes'
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

/**
 * Verify OTP and reset password
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const verifyOTPAndResetPassword = async (req, res) => {
  const { credentials, otp, newPassword } = req.body;

  if (!credentials || !otp || !newPassword) {
    return res.status(400).json({ 
      error: 'Email, OTP, and new password are required.' 
    });
  }

  try {
    // Get user
    const userResult = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [credentials]
    );

    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Get stored OTP
    const tokenResult = await db.query(
      'SELECT * FROM otp_tokens WHERE user_id = $1',
      [user.user_id]
    );

    const tokenRecord = tokenResult.rows[0];

    if (!tokenRecord) {
      return res.status(400).json({ 
        error: 'No password reset request found. Please request a new code.' 
      });
    }

    // Check if OTP is expired
    if (new Date() > new Date(tokenRecord.expires_at)) {
      return res.status(400).json({ 
        error: 'Password reset code has expired. Please request a new code.' 
      });
    }

    // Decrypt stored OTP
    const bytes = CryptoJS.AES.decrypt(
      tokenRecord.token,
      process.env.SECRET_KEY
    );
    const decryptedStoredOTP = bytes.toString(CryptoJS.enc.Utf8);

    // Verify OTP - ensure both are strings and trim any whitespace
    if (otp.toString().trim() !== decryptedStoredOTP.trim()) {
      return res.status(400).json({ error: 'Invalid password reset code.' });
    }

    // Encrypt new password
    // const encryptedPassword = CryptoJS.AES.encrypt(
    //   newPassword,
    //   process.env.SECRET_KEY
    // ).toString();

    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1 WHERE user_id = $2',
      [newPassword, user.user_id]
    );

    // Delete used token
    // await db.query(
    //   'DELETE FROM otp_tokens WHERE user_id = $1',
    //   [user.user_id]
    // );

    res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    console.error('Password reset verification error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = { requestPasswordReset, verifyOTPAndResetPassword };