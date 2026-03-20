const bcrypt = require('bcrypt');
const db = require('../db/database');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });
const CryptoJS = require("crypto-js");
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const fs = require('fs');

const {
  generateAccessToken,
  generateRefreshToken,
} = require("../config/jwtConfig");

const { sendOtp, verifyOtp } = require('../services/TwoFactorService');

function encryptPassword(password) {
  const secretKey = process.env.SECRET_KEY;
  if (!secretKey) {
    throw new Error('SECRET_KEY is not configured');
  }
  return CryptoJS.AES.encrypt(password, secretKey).toString();
}

const registerUser = async (req, res) => {
  const { firstName, lastName, email, phone, password } = req.body;

  if (!firstName || !lastName || !phone || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    // Check if user exists and is verified
    const existingUser = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      if (existingUser.rows[0].is_email_verified) {
        // If they are verified but we are here, it means they might be trying to register again
        // or the placeholder was already updated.
        // If first_name is NOT 'Pending', they are fully registered.
        if (existingUser.rows[0].first_name !== 'Pending') {
           return res.status(409).json({ error: 'Email already exists.' });
        }
      } else {
        return res.status(403).json({ error: 'Email not verified. Please verify your email first.' });
      }
    } else {
      return res.status(403).json({ error: 'Email not verified. Please verify your email first.' });
    }

    // Update the placeholder user with actual data
    const result = await db.query(
      `UPDATE users 
       SET first_name = $1, last_name = $2, phone = $3, password_hash = $4
       WHERE email = $5
       RETURNING user_id, email, first_name, last_name, role, created_at`,
      [firstName, lastName, phone, password, email]
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: result.rows[0],
    });
  } catch (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Email or phone already exists.' });
    } else {
      console.error('Error saving user:', error);
      res.status(500).json({ error: 'Internal server error.' });
    }
  }
};

const signin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Decrypt the stored password and compare with plain password
    const decryptedDbPassword = decryptPassword(user.password_hash);
    console.log("decryptedDbPassword:", decryptedDbPassword);
    
    if (!decryptedDbPassword) {
      return res.status(500).json({ error: 'Error processing credentials' });
    }
    console.log(decryptPassword(decryptedDbPassword));
    const decryptedPassword = decryptPassword(password);
    console.log("decryptedPassword:", decryptedPassword);
    
    const isValidPassword = decryptedDbPassword === decryptedPassword;
    console.log("isValidPassword:", isValidPassword);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      {
        userId: user.user_id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET_KEY,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        userId: user.user_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const vendorSignin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const result = await db.query(
      'SELECT * FROM sb_vendors WHERE email = $1',
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // ✅ Decrypt the password sent from frontend
    const decryptedRequestPassword = decryptPassword(password);
    console.log("Decrypted request password:", decryptedRequestPassword);
    
    if (!decryptedRequestPassword) {
      return res.status(500).json({ error: 'Error processing credentials' });
    }

    // ✅ Decrypt the stored password from database
    const decryptedDbPassword = decryptPassword(user.password);
    console.log("Decrypted DB password:", decryptedDbPassword);

    if (!decryptedDbPassword) {
      return res.status(500).json({ error: 'Error processing stored credentials' });
    }

    // ✅ Compare the two decrypted (plain text) passwords
    const isValidPassword = decryptedRequestPassword === decryptedDbPassword;
    console.log("Password match:", isValidPassword);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      {
        vendorId: user.vendor_id,
        email: user.email,
        role: user.role,
        name: user.vendor_name
      },
      process.env.JWT_SECRET_KEY,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        userId: user.vendor_id, // ✅ Changed from user.user_id to match JWT
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        name: user.vendor_name
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};


function decryptPassword(encryptedPassword) {
  try {
    const secretKey = process.env.SECRET_KEY;
    if (!secretKey) {
      console.error('SECRET_KEY is not configured');
      return null;
    }
    if (!encryptedPassword) {
      console.error('No encrypted password provided');
      return null;
    }
    const bytes = CryptoJS.AES.decrypt(encryptedPassword, secretKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

const loginWithGoogle = async (req, res) => {
  const { token } = req.body;
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  try {
    // Verify the Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    console.log("Decoded Payload:", payload);

    const googleProfileId = payload["sub"];
    const email = payload["email"];
    const name = payload["name"];

    // Check if the user already exists
    const existingUser = await db.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows && existingUser.rows.length > 0) {
      // User exists, check if Google ID is already linked
      let user = existingUser.rows[0];

      if (!user.google_profile_id) {
        // Update user with Google ID
        await db.query(
          "UPDATE users SET google_profile_id = $1, is_google_user = $2 WHERE email = $3",
          [googleProfileId, 1, email]
        );
        user.google_profile_id = googleProfileId;
      } else if (user.google_profile_id !== googleProfileId) {
        return res.status(400).json({
          success: false,
          message: "Google profile does not match our records.",
        });
      }

      // Generate tokens for the existing user
      const accessToken = jwt.sign(
        {
          userId: user.user_id,
          email: user.email,
        },
        process.env.JWT_SECRET_KEY,
        { expiresIn: '1h' }
      );

      const refreshToken = jwt.sign(
        { userId: user.user_id },
        process.env.JWT_SECRET_KEY,
        { expiresIn: '7d' }
      );

      return res.status(200).json({
        success: true,
        message: "User logged in successfully.",
        accessToken,
        refreshToken,
      });
    } else {
      // User does not exist, create a new record
      const query = `INSERT INTO users (first_name, email, is_google_user, google_profile_id) VALUES ($1, $2, $3, $4) RETURNING user_id`;
      const result = await db.query(query, [
        name,
        email,
        1,
        googleProfileId
      ]);

      const userId = result.rows[0].user_id;
      const accessToken = jwt.sign(
        {
          userId: user.user_id,
          email: user.email,
          role: user.role
        },
        process.env.JWT_SECRET_KEY,
        { expiresIn: '24h' }
      );

      const refreshToken = jwt.sign(
        {
          userId: user.user_id,
          email: user.email,
          role: user.role
        },
        process.env.JWT_SECRET_KEY,
        { expiresIn: '24h' }
      );

      return res.status(201).json({
        success: true,
        message: "User registered and logged in successfully.",
        accessToken,
        refreshToken,
      });
    }
  } catch (error) {
    console.error("Error logging in with Google:", error);
    res.status(500).json({
      success: false,
      message: "Failed to log in with Google.",
      error: error.message,
    });
  }
};

const sendLoginOtp = async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  try {
    // Check if user exists with this phone number
    const result = await db.query(
      'SELECT * FROM users WHERE phone = $1',
      [phone]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found with this phone number.' });
    }

    const otpResponse = await sendOtp(phone);

    if (otpResponse.Status === 'Success') {
      res.status(200).json({
        message: 'OTP sent successfully',
        sessionId: otpResponse.Details
      });
    } else {
      res.status(500).json({ error: 'Failed to send OTP' });
    }

  } catch (error) {
    console.error('Error sending login OTP:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const verifyLoginOtp = async (req, res) => {
  const { phone, otp, sessionId } = req.body;

  if (!phone || !otp || !sessionId) {
    return res.status(400).json({ error: 'Phone, OTP, and Session ID are required.' });
  }

  try {
    const verificationResponse = await verifyOtp(sessionId, otp);

    if (verificationResponse.Status === 'Success' && verificationResponse.Details === 'OTP Matched') {
       // OTP is valid, log the user in
       const result = await db.query(
        'SELECT * FROM users WHERE phone = $1',
        [phone]
      );
  
      const user = result.rows[0];
  
      if (!user) {
        // This shouldn't happen if sendLoginOtp checks for user, but good to be safe
        return res.status(404).json({ error: 'User not found.' });
      }

      const token = jwt.sign(
        {
          userId: user.user_id,
          email: user.email,
          role: user.role
        },
        process.env.JWT_SECRET_KEY,
        { expiresIn: '7d' }
      );
  
      res.status(200).json({
        message: 'Login successful',
        token,
        user: {
          userId: user.user_id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        }
      });

    } else {
      res.status(400).json({ error: 'Invalid OTP' });
    }

  } catch (error) {
    console.error('Error verifying login OTP:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const sendRegistrationOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    // Check if user exists
    const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    let user = userResult.rows[0];

    if (user && user.is_email_verified && user.first_name !== 'Pending') {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    if (!user) {
      // Create placeholder user
      const insertResult = await db.query(
        "INSERT INTO users (email, first_name, is_email_verified) VALUES ($1, 'Pending', false) RETURNING *",
        [email]
      );
      user = insertResult.rows[0];
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 10);

    // Encrypt OTP
    const encryptedOTP = CryptoJS.AES.encrypt(otp, process.env.SECRET_KEY).toString();

    // Store in otp_tokens
    await db.query(
      `INSERT INTO otp_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) 
       DO UPDATE SET token = $2, expires_at = $3, created_at = NOW()`,
      [user.user_id, encryptedOTP, expiryTime]
    );

    // Send Email
    const templatePath = path.join(__dirname, '../templates/registration-otp-template.html');
    let emailTemplate = fs.readFileSync(templatePath, 'utf8');
    emailTemplate = emailTemplate.replace('123456', otp);

    const { sendEmail } = require('../services/emailService');
    await sendEmail({
      to: email,
      subject: 'Email Verification Code',
      text: `Your verification code is: ${otp}`,
      html: emailTemplate
    });

    res.status(200).json({ message: 'Verification code sent to email.' });
  } catch (error) {
    console.error('Send registration OTP error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const verifyRegistrationOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required.' });
  }

  try {
    const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const otpResult = await db.query('SELECT * FROM otp_tokens WHERE user_id = $1', [user.user_id]);
    const tokenRecord = otpResult.rows[0];

    if (!tokenRecord) {
      return res.status(400).json({ error: 'OTP not found or expired.' });
    }

    if (new Date() > new Date(tokenRecord.expires_at)) {
      return res.status(400).json({ error: 'OTP expired.' });
    }

    // Decrypt and compare
    const bytes = CryptoJS.AES.decrypt(tokenRecord.token, process.env.SECRET_KEY);
    const decryptedOTP = bytes.toString(CryptoJS.enc.Utf8);

    if (decryptedOTP !== otp) {
      return res.status(400).json({ error: 'Invalid OTP.' });
    }

    // Mark as verified
    await db.query('UPDATE users SET is_email_verified = true WHERE user_id = $1', [user.user_id]);
    // Optional: Delete OTP token after successful verification
    await db.query('DELETE FROM otp_tokens WHERE user_id = $1', [user.user_id]);

    res.status(200).json({ message: 'Email verified successfully.' });
  } catch (error) {
    console.error('Verify registration OTP error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = { registerUser, signin, loginWithGoogle, vendorSignin, sendLoginOtp, verifyLoginOtp, sendRegistrationOtp, verifyRegistrationOtp };
