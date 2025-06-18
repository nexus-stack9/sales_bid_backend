const db = require('../db/database');

// Store active connections and their intervals
const activeConnections = new Map();

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

module.exports = {
    initProductWebSocket
};
