const axios = require('axios');

class ShiprocketPriceCalculator {
    constructor(email, password) {
        this.email = email;
        this.password = password;
        this.token = null;
        this.baseURL = 'https://apiv2.shiprocket.in/v1/external';
    }

    // Authenticate and get token
    async authenticate() {
        try {
            const response = await axios.post(`${this.baseURL}/auth/login`, {
                email: process.env.SHIPROCKET_EMAIL,
                password: process.env.SHIPROCKET_PASSWORD
            });
            
            this.token = response.data.token;
            return this.token;
        } catch (error) {
            throw new Error(`Authentication failed: ${error.response?.data?.message || error.message}`);
        }
    }

    // Calculate shipping rates
    async calculateShippingRate(packageDetails) {
        try {
            if (!this.token) {
                await this.authenticate();
            }

            const {
                pickup_postcode,
                delivery_postcode,
                weight, // in kg
                length, // in cm
                breadth, // in cm
                height, // in cm
                cod = 0 // 1 for COD, 0 for prepaid
            } = packageDetails;

            const response = await axios.get(`${this.baseURL}/courier/serviceability/`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    pickup_postcode,
                    delivery_postcode,
                    weight,
                    length,
                    breadth,
                    height,
                    cod
                }
            });

            return this.formatPricingResponse(response.data);
        } catch (error) {
            throw new Error(`Rate calculation failed: ${error.response?.data?.message || error.message}`);
        }
    }

    // Format the response for better readability
    formatPricingResponse(data) {
        if (!data.data || !data.data.available_courier_companies) {
            return { error: 'No courier services available for this route' };
        }

        const courierOptions = data.data.available_courier_companies.map(courier => ({
            courier_name: courier.courier_name,
            courier_company_id: courier.courier_company_id,
            rate: courier.rate,
            cod_charges: courier.cod_charges,
            freight_charge: courier.freight_charge,
            estimated_delivery_days: courier.estimated_delivery_days,
            etd: courier.etd,
            base_courier_id: courier.base_courier_id,
            local_region: courier.local_region,
            metro: courier.metro,
            zone: courier.zone
        }));

        // Sort by rate (cheapest first)
        courierOptions.sort((a, b) => a.rate - b.rate);

        return {
            pickup_postcode: data.data.pickup_postcode,
            delivery_postcode: data.data.delivery_postcode,
            total_options: courierOptions.length,
            cheapest_option: courierOptions[0],
            all_options: courierOptions
        };
    }

    // Get specific courier company rates
    async getCourierSpecificRate(packageDetails, courierCompanyId) {
        try {
            const allRates = await this.calculateShippingRate(packageDetails);
            
            if (allRates.error) {
                return allRates;
            }

            const specificCourier = allRates.all_options.find(
                courier => courier.courier_company_id === courierCompanyId
            );

            return specificCourier ? specificCourier : { error: 'Courier company not available for this route' };
        } catch (error) {
            throw new Error(`Specific courier rate calculation failed: ${error.message}`);
        }
    }

    // Calculate volumetric weight
    static calculateVolumetricWeight(length, breadth, height) {
        // Volumetric weight = (L × B × H) / 5000 (for domestic shipping in India)
        return (length * breadth * height) / 5000;
    }

    // Get effective weight (higher of actual weight or volumetric weight)
    static getEffectiveWeight(actualWeight, length, breadth, height) {
        const volumetricWeight = this.calculateVolumetricWeight(length, breadth, height);
        return Math.max(actualWeight, volumetricWeight);
    }
}

// Usage Example
async function calculateDeliveryPrice() {
    const shiprocket = new ShiprocketPriceCalculator(
        process.env.SHIPROCKET_EMAIL,
        process.env.SHIPROCKET_PASSWORD
    );

    const packageDetails = {
        pickup_postcode: '110001',    // Delhi
        delivery_postcode: '400001',  // Mumbai
        weight: 1.5,                  // 1.5 kg
        length: 20,                   // 20 cm
        breadth: 15,                  // 15 cm
        height: 10,                   // 10 cm
        cod: 0                        // Prepaid (0) or COD (1)
    };

    try {
        // Calculate effective weight
        const volumetricWeight = ShiprocketPriceCalculator.calculateVolumetricWeight(
            packageDetails.length, 
            packageDetails.breadth, 
            packageDetails.height
        );
        
        console.log(`Actual Weight: ${packageDetails.weight} kg`);
        console.log(`Volumetric Weight: ${volumetricWeight.toFixed(2)} kg`);
        console.log(`Effective Weight: ${Math.max(packageDetails.weight, volumetricWeight).toFixed(2)} kg\n`);

        // Get all available rates
        const rates = await shiprocket.calculateShippingRate(packageDetails);
        
        if (rates.error) {
            console.error('Error:', rates.error);
            return;
        }

        console.log('=== SHIPPING RATE CALCULATION ===');
        console.log(`From: ${rates.pickup_postcode} → To: ${rates.delivery_postcode}`);
        console.log(`Total courier options: ${rates.total_options}\n`);

        console.log('=== CHEAPEST OPTION ===');
        const cheapest = rates.cheapest_option;
        console.log(`Courier: ${cheapest.courier_name}`);
        console.log(`Rate: ₹${cheapest.rate}`);
        console.log(`COD Charges: ₹${cheapest.cod_charges}`);
        console.log(`Delivery Time: ${cheapest.estimated_delivery_days} days`);
        console.log(`Zone: ${cheapest.zone}\n`);

        console.log('=== ALL OPTIONS ===');
        rates.all_options.forEach((courier, index) => {
            console.log(`${index + 1}. ${courier.courier_name}`);
            console.log(`   Rate: ₹${courier.rate} | COD: ₹${courier.cod_charges} | ETA: ${courier.estimated_delivery_days} days`);
        });

        return rates;

    } catch (error) {
        console.error('Error calculating shipping rates:', error.message);
    }
}

// Alternative function for quick rate check
async function quickRateCheck(pickup_pin, delivery_pin, weight, dimensions) {
    const shiprocket = new ShiprocketPriceCalculator(
        process.env.SHIPROCKET_EMAIL,
        process.env.SHIPROCKET_PASSWORD
    );

    try {
        const packageDetails = {
            pickup_postcode: pickup_pin,
            delivery_postcode: delivery_pin,
            weight: weight,
            length: dimensions.length,
            breadth: dimensions.breadth,
            height: dimensions.height,
            cod: 0
        };

        const rates = await shiprocket.calculateShippingRate(packageDetails);
        return rates.cheapest_option || rates;

    } catch (error) {
        console.error('Quick rate check failed:', error.message);
        return null;
    }
}

// Export for use in other modules
module.exports = {
    ShiprocketPriceCalculator,
    calculateDeliveryPrice,
    quickRateCheck
};

// Uncomment to run the example
// calculateDeliveryPrice();