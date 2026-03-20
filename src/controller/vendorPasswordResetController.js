const fs = require('fs');
const path = require('path');
const db = require('../db/database');
const { sendEmail } = require('../services/emailService');
const CryptoJS = require('crypto-js');
require('dotenv').config();

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const decryptPassword = (encryptedPassword) => {
  try {
    const secretKey = process.env.SECRET_KEY;
    if (!secretKey || !encryptedPassword) {
      return null;
    }
    const bytes = CryptoJS.AES.decrypt(encryptedPassword, secretKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};

const encryptPassword = (password) => {
  try {
    const secretKey = process.env.SECRET_KEY;
    if (!secretKey || !password) {
      return null;
    }
    return CryptoJS.AES.encrypt(password, secretKey).toString();
  } catch (error) {
    console.error('Encryption error:', error);
    return null;
  }
};

const requestVendorPasswordReset = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const vendorResult = await db.query(
      'SELECT * FROM sb_vendors WHERE email = $1',
      [email]
    );

    const vendor = vendorResult.rows[0];

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found with this email.' });
    }

    const otp = generateOTP();
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 10);

    await db.query(
      `INSERT INTO vendor_otp_tokens (vendor_id, token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (vendor_id) 
       DO UPDATE SET token = $2, expires_at = $3, created_at = NOW()`,
      [vendor.vendor_id, otp, expiryTime]
    );

    const templatePath = path.join(__dirname, '../templates/vendor-otp-email-template.html');
    let emailTemplate = fs.readFileSync(templatePath, 'utf8');

    emailTemplate = emailTemplate.replace('{{OTP_CODE}}', otp);

    await sendEmail({
      to: email,
      subject: 'Vendor Password Reset Code',
      text: `Your password reset code is: ${otp}. This code is valid for 10 minutes.`,
      html: emailTemplate
    });

    res.status(200).json({
      message: 'Password reset code sent to your email.',
      expiresIn: '10 minutes'
    });
  } catch (error) {
    console.error('Vendor password reset request error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const verifyVendorOTPAndResetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ 
      error: 'Email, OTP, and new password are required.' 
    });
  }

  try {
    const vendorResult = await db.query(
      'SELECT * FROM sb_vendors WHERE email = $1',
      [email]
    );

    const vendor = vendorResult.rows[0];

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found.' });
    }

    const tokenResult = await db.query(
      'SELECT * FROM vendor_otp_tokens WHERE vendor_id = $1',
      [vendor.vendor_id]
    );

    const tokenRecord = tokenResult.rows[0];

    if (!tokenRecord) {
      return res.status(400).json({ 
        error: 'No password reset request found. Please request a new code.' 
      });
    }

    if (new Date() > new Date(tokenRecord.expires_at)) {
      return res.status(400).json({ 
        error: 'Password reset code has expired. Please request a new code.' 
      });
    }

    if (otp.toString().trim() !== tokenRecord.token.trim()) {
      return res.status(400).json({ error: 'Invalid password reset code.' });
    }

    const encryptedPassword = encryptPassword(newPassword);
    if (!encryptedPassword) {
      return res.status(500).json({ error: 'Error encrypting password.' });
    }

    await db.query(
      'UPDATE sb_vendors SET password = $1 WHERE vendor_id = $2',
      [encryptedPassword, vendor.vendor_id]
    );

    await db.query(
      'DELETE FROM vendor_otp_tokens WHERE vendor_id = $1',
      [vendor.vendor_id]
    );

    res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    console.error('Vendor password reset verification error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const changeVendorPassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const vendorId = req.user.vendorId;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  try {
    const vendorResult = await db.query(
      'SELECT * FROM sb_vendors WHERE vendor_id = $1',
      [vendorId]
    );

    const vendor = vendorResult.rows[0];

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found.' });
    }

    const decryptedCurrentPassword = decryptPassword(currentPassword);
    const decryptedStoredPassword = decryptPassword(vendor.password);

    if (!decryptedCurrentPassword || !decryptedStoredPassword) {
      return res.status(500).json({ error: 'Error processing passwords.' });
    }

    if (decryptedCurrentPassword !== decryptedStoredPassword) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const encryptedPassword = encryptPassword(newPassword);
    if (!encryptedPassword) {
      return res.status(500).json({ error: 'Error encrypting password.' });
    }

    await db.query(
      'UPDATE sb_vendors SET password = $1 WHERE vendor_id = $2',
      [encryptedPassword, vendorId]
    );

    res.status(200).json({ message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Vendor password change error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = { 
  requestVendorPasswordReset, 
  verifyVendorOTPAndResetPassword,
  changeVendorPassword
};
