const bcrypt = require('bcrypt');
const db = require('../db/database');
require('dotenv').config();
const CryptoJS = require("crypto-js");
const jwt = require('jsonwebtoken');

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

module.exports = { registerUser, signin };
