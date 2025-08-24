const express = require('express');
const router = express.Router();
const { ShiprocketPriceCalculator } = require('../controller/ShipRocketController');

// Initialize the ShiprocketPriceCalculator with environment variables
const shiprocket = new ShiprocketPriceCalculator(
    process.env.SHIPROCKET_EMAIL,
    process.env.SHIPROCKET_PASSWORD
);

// Calculate shipping rates
router.post('/calculate-shipping-rates', async (req, res) => {
    try {
        const {
            pickup_postcode,
            delivery_postcode,
            weight,
            length,
            breadth,
            height,
            declared_value = 100,
            cod = 0
        } = req.body;

        // Validate required fields
        if (!pickup_postcode || !delivery_postcode || !weight || !length || !breadth || !height) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields. Required: pickup_postcode, delivery_postcode, weight, length, breadth, height'
            });
        }

        const rates = await shiprocket.calculateShippingRate({
            pickup_postcode,
            delivery_postcode,
            weight: parseFloat(weight),
            length: parseFloat(length),
            breadth: parseFloat(breadth),
            height: parseFloat(height),
            declared_value: parseFloat(declared_value) || 100,
            cod: parseInt(cod) === 1 ? 1 : 0
        });

        res.json({
            success: true,
            data: rates
        });
    } catch (error) {
        console.error('Error calculating shipping rates:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to calculate shipping rates'
        });
    }
});

// Get specific courier rate
router.post('/courier-rate', async (req, res) => {
    try {
        const {
            pickup_postcode,
            delivery_postcode,
            weight,
            length,
            breadth,
            height,
            courier_company_id,
            declared_value = 100,
            cod = 0
        } = req.body;

        // Validate required fields
        if (!pickup_postcode || !delivery_postcode || !weight || !length || !breadth || !height || !courier_company_id) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields. Required: pickup_postcode, delivery_postcode, weight, length, breadth, height, courier_company_id'
            });
        }

        const packageDetails = {
            pickup_postcode,
            delivery_postcode,
            weight: parseFloat(weight),
            length: parseFloat(length),
            breadth: parseFloat(breadth),
            height: parseFloat(height),
            declared_value: parseFloat(declared_value) || 100,
            cod: parseInt(cod) === 1 ? 1 : 0
        };

        const rate = await shiprocket.getCourierSpecificRate(packageDetails, courier_company_id);
        
        if (rate.error) {
            return res.status(404).json({
                success: false,
                message: rate.error
            });
        }

        res.json({
            success: true,
            data: rate
        });
    } catch (error) {
        console.error('Error getting courier rate:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get courier rate'
        });
    }
});

// Calculate volumetric weight
router.post('/calculate-volumetric-weight', (req, res) => {
    try {
        const { length, breadth, height } = req.body;
        
        if (!length || !breadth || !height) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields. Required: length, breadth, height'
            });
        }

        const volumetricWeight = ShiprocketPriceCalculator.calculateVolumetricWeight(
            parseFloat(length),
            parseFloat(breadth),
            parseFloat(height)
        );

        res.json({
            success: true,
            data: {
                volumetric_weight: volumetricWeight
            }
        });
    } catch (error) {
        console.error('Error calculating volumetric weight:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to calculate volumetric weight'
        });
    }
});

module.exports = router;
