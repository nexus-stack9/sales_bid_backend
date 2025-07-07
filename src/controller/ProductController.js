const db = require('../db/database');

// Store active connections and their intervals
const activeConnections = new Map();

// WebSocket functionality for real-time product updates
const initProductWebSocket = (wss) => {
    wss.on('connection', (ws, req) => {
        // Get the product_id from the URL query parameters
        const url = new URL(req.url, `http://${req.headers.host}`);
        const productId = url.searchParams.get('product_id');
        
        if (!productId) {
            ws.send(JSON.stringify({ error: 'Product ID is required' }));
            return ws.close();
        }

        console.log(`New WebSocket connection for product ID: ${productId}`);
        
        // Function to fetch and send product details
        const fetchAndSendProductDetails = async () => {
            try {
                // Use parameterized query with $1 for PostgreSQL
                const query = 'SELECT * FROM vw_get_product_details WHERE product_id = $1';
                console.log('Executing query:', query, 'with product_id:', productId);
                
                // Ensure the database connection is established
                if (!db) {
                    throw new Error('Database connection not established');
                }

                // Execute the query using async/await
                const result = await db.query(query, [productId]);
                
                // Check if we got any results
                if (!result.rows || result.rows.length === 0) {
                    console.log('No product found for ID:', productId);
                    ws.send(JSON.stringify({ 
                        type: 'error',
                        message: 'Product not found',
                        productId: productId
                    }));
                    return ws.close();
                }
                
                console.log('Query successful, rows found:', result.rows.length);
                
                // Send the first row of results
                ws.send(JSON.stringify({
                    type: 'product_update',
                    data: result.rows[0],
                    timestamp: new Date().toISOString()
                }));
            } catch (error) {
                console.error('Error in fetchAndSendProductDetails:', {
                    message: error.message,
                    stack: error.stack,
                    productId: productId
                });
                
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Failed to fetch product details',
                    error: error.message,
                    details: error.toString(),
                    productId: productId
                }));
                
                // Don't close the connection on first error, let it retry
                // ws.close();
            }
        };

        // Initial fetch
        fetchAndSendProductDetails();

        // Set up interval for periodic updates (every 5 seconds)
        const interval = setInterval(fetchAndSendProductDetails, 5000);

        // Store the interval with the WebSocket connection
        activeConnections.set(ws, { interval, productId });

        // Handle WebSocket close
        ws.on('close', () => {
            console.log(`WebSocket connection closed for product ID: ${productId}`);
            const connection = activeConnections.get(ws);
            if (connection) {
                clearInterval(connection.interval);
                activeConnections.delete(ws);
            }
        });

        // Handle errors
        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            const connection = activeConnections.get(ws);
            if (connection) {
                clearInterval(connection.interval);
                activeConnections.delete(ws);
            }
            ws.close();
        });
    });

    // Clean up all intervals when the server shuts down
    process.on('SIGINT', () => {
        console.log('Shutting down WebSocket server...');
        for (const [ws, { interval }] of activeConnections.entries()) {
            clearInterval(interval);
            ws.terminate();
        }
        wss.close();
        process.exit(0);
    });
};

// API Controllers for Products

// Get all products
const getAllProducts = async (req, res) => {
    try {
        const query = 'SELECT * FROM view_products_with_bid_stats';
        const result = await db.query(query);
        
        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch products',
            error: error.message
        });
    }
};

// Get product by UID
const getProductByUid = async (req, res) => {
    try {
        const { uid } = req.params;
        
        if (!uid) {
            return res.status(400).json({
                success: false,
                message: 'Product UID is required'
            });
        }
        
        const query = 'SELECT * FROM view_products_with_bid_stats WHERE product_id = $1';
        const result = await db.query(query, [uid]);
        
        if (!result.rows || result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }
        
        res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching product by UID:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch product',
            error: error.message
        });
    }
};

// Add a new product
const addProduct = async (req, res) => {
    try {
        const {
            name,
            description,
            starting_price,
            category_id,
            auction_start,
            auction_end,
            retail_value,
            location,
            shipping,
            quantity,
            image_path,
            created_by,
            vendor_id,
            trending,
            tags
        } = req.body;

        // Validate required fields
        if (!name || !starting_price || !auction_start || !auction_end) {
            return res.status(400).json({
                success: false,
                message: 'Name, starting price, auction start, and auction end are required fields'
            });
        }

        // Insert the new product
        const query = `
            INSERT INTO products (
                name, description, starting_price, category_id,
                auction_start, auction_end, retail_value, location,
                shipping, quantity, image_path, created_by, vendor_id, trending, tags
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
        `;

        const values = [
            name,
            description || null,
            starting_price,
            category_id || null,
            auction_start,
            auction_end,
            retail_value || null,
            location || null,
            shipping || null,
            quantity || null,
            image_path || null,
            created_by || null,
            vendor_id || null,
            trending || false,
            tags || null
        ];

        const result = await db.query(query, values);

        return res.status(201).json({
            success: true,
            message: 'Product added successfully',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Error adding product:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add product',
            error: error.message
        });
    }
};

// API Controllers for Wishlist

// Add product to wishlist
const addToWishlist = async (req, res) => {
    try {
        const { user_id, product_id } = req.body;
        
        if (!user_id || !product_id) {
            return res.status(400).json({
                success: false,
                message: 'User ID and Product ID are required'
            });
        }
        
        // Check if the product exists
        const productQuery = 'SELECT * FROM products WHERE product_id = $1';
        const productResult = await db.query(productQuery, [product_id]);
        
        if (!productResult.rows || productResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }
        
        // Check if the item is already in the wishlist
        const checkQuery = 'SELECT * FROM user_watchlist WHERE user_id = $1 AND product_id = $2';
        const checkResult = await db.query(checkQuery, [user_id, product_id]);
        
        if (checkResult.rows && checkResult.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Product already in wishlist'
            });
        }
        
        // Add to wishlist
        const insertQuery = 'INSERT INTO user_watchlist (user_id, product_id, added_at) VALUES ($1, $2, NOW()) RETURNING *';
        const result = await db.query(insertQuery, [user_id, product_id]);
        
        res.status(201).json({
            success: true,
            message: 'Product added to wishlist',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error adding to wishlist:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add product to wishlist',
            error: error.message
        });
    }
};

// Remove product from wishlist
const removeFromWishlist = async (req, res) => {
    try {
        const { user_id, product_id } = req.body;
        
        if (!user_id || !product_id) {
            return res.status(400).json({
                success: false,
                message: 'User ID and Product ID are required'
            });
        }
        
        // Check if the item is in the wishlist
        const checkQuery = 'SELECT * FROM user_watchlist WHERE user_id = $1 AND product_id = $2';
        const checkResult = await db.query(checkQuery, [user_id, product_id]);
        
        if (!checkResult.rows || checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Product not found in wishlist'
            });
        }
        
        // Remove from wishlist
        const deleteQuery = 'DELETE FROM user_watchlist WHERE user_id = $1 AND product_id = $2 RETURNING *';
        const result = await db.query(deleteQuery, [user_id, product_id]);
        
        res.status(200).json({
            success: true,
            message: 'Product removed from wishlist',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error removing from wishlist:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove product from wishlist',
            error: error.message
        });
    }
};


module.exports = {
    initProductWebSocket,
    getAllProducts,
    getProductByUid,
    addProduct,
    addToWishlist,
    removeFromWishlist,
    activeConnections // Export for cleanup on server shutdown
};
