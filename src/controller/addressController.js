const db = require('../db/database');

const addAddress = async (req, res) => {
    const { 
        userId,
        label, 
        street, 
        city, 
        state, 
        postalCode, 
        country, 
        isPrimary 
    } = req.body;

    if (!userId || !street || !city || !state || !postalCode || !country) {
        return res.status(400).json({ 
            error: 'Required fields missing. Please provide userId, street, city, state, postalCode, and country.' 
        });
    }

    try {
        // If this is marked as primary, update all other addresses to non-primary
        if (isPrimary) {
            await db.query(
                'UPDATE addresses SET is_primary = false WHERE user_id = $1',
                [userId]
            );
        }

        const result = await db.query(
            `INSERT INTO addresses 
            (user_id, label, street, city, state, postal_code, country, is_primary)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [userId, label, street, city, state, postalCode, country, isPrimary || false]
        );

        res.status(201).json({
            message: 'Address added successfully',
            address: result.rows[0]
        });

    } catch (error) {
        console.error('Error adding address:', error);
        
        if (error.code === '23503') {
            return res.status(400).json({ 
                error: 'User not found. Please provide a valid user ID.' 
            });
        }

        res.status(500).json({ 
            error: 'Internal server error occurred while adding the address.' 
        });
    }
};

module.exports = {
    addAddress
};