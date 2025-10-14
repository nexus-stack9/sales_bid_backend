const bcrypt = require('bcrypt');
const db = require('../db/database');
require('dotenv').config();
const CryptoJS = require("crypto-js");
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const {
  generateAccessToken,
  generateRefreshToken,
} = require("../config/jwtConfig");

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
    // Encrypt the password before storing
    // const encryptedPassword = encryptPassword(password);

    const result = await db.query(
      `INSERT INTO users (first_name, last_name, email, phone, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING user_id, email, first_name, last_name, role, created_at`,
      [firstName, lastName, email, phone, password]
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

    // Decrypt the stored password and compare with plain password
    const decryptedDbPassword = decryptPassword(password);
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


module.exports = { registerUser, signin, loginWithGoogle, vendorSignin };
