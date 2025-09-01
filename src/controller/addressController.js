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

const getAddressesById = async (req, res) => {
    try {
        const userId = req.params.id;
        const result = await db.query(
            'SELECT * FROM addresses WHERE user_id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'No addresses found for this user.'
            });
        }

        res.json({
            message: 'Addresses fetched successfully',
            addresses: result.rows
        });
    } catch (error) {
        console.error('Error fetching addresses:', error);
        res.status(500).json({
            error: 'Internal server error occurred while fetching addresses.'
        });
    }
};

const editAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const updateData = req.body;
        
        const result = await db.query(
            `UPDATE addresses SET 
            label = COALESCE($1, label),
            street = COALESCE($2, street),
            city = COALESCE($3, city),
            state = COALESCE($4, state),
            postal_code = COALESCE($5, postal_code),
            country = COALESCE($6, country),
            is_primary = COALESCE($7, is_primary)
            WHERE id = $8
            RETURNING *`,
            [updateData.label, updateData.street, updateData.city, updateData.state, updateData.postalCode, updateData.country, updateData.isPrimary, addressId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Address not found.' 
            });
        }

        res.json({
            message: 'Address updated successfully',
            address: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating address:', error);
        res.status(500).json({
            error: 'Internal server error occurred while updating the address.'
        });
    }
};

const deleteAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        
        const result = await db.query(
            'DELETE FROM addresses WHERE id = $1 RETURNING *',
            [addressId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Address not found.' 
            });
        }

        res.json({
            message: 'Address deleted successfully',
            address: result.rows[0]
        });
    } catch (error) {
        console.error('Error deleting address:', error);
        res.status(500).json({
            error: 'Internal server error occurred while deleting the address.'
        });
    }
};

module.exports = {
    addAddress,
    getAddressesById,
    editAddress,
    deleteAddress
};