const db = require('../db/database');
const cloudflareStreamService = require('../services/cloudflareStreamService');

/**
 * Create a new live stream for a product
 */
const createLiveStream = async (req, res) => {
    const { productId, productName } = req.body;

    if (!productId) {
        return res.status(400).json({ error: 'Product ID is required' });
    }

    try {
        // Check if product exists
        const productCheck = await db.query(
            'SELECT product_id, name FROM products WHERE product_id = $1',
            [productId]
        );

        if (productCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const product = productCheck.rows[0];
        const name = productName || product.name;

        // Check if product already has an active live stream
        const existingStream = await db.query(
            'SELECT live_input_id, is_live FROM products WHERE product_id = $1 AND live_input_id IS NOT NULL',
            [productId]
        );

        if (existingStream.rows.length > 0 && existingStream.rows[0].is_live) {
            return res.status(400).json({ 
                error: 'Product already has an active live stream',
                liveInputId: existingStream.rows[0].live_input_id
            });
        }

        // Create live input in Cloudflare
        const liveInput = await cloudflareStreamService.createLiveInput(productId, name);

        // Generate the product live URL using the template from environment variables
        const productLiveUrl = process.env.CF_LIVE_URL.replace('{live_input_id}', liveInput.liveInputId);

        // Update product with live stream details
        await db.query(
            `UPDATE products 
             SET live_input_id = $1, 
                 stream_key = $2, 
                 rtmp_url = $3, 
                 product_live_url = $4,
                 is_live = false,
                 updated_at = NOW()
             WHERE product_id = $5`,
            [liveInput.liveInputId, liveInput.streamKey, liveInput.rtmpUrl, productLiveUrl, productId]
        );

        res.status(201).json({
            success: true,
            message: 'Live stream created successfully',
            data: {
                productId,
                liveInputId: liveInput.liveInputId,
                rtmpUrl: liveInput.rtmpUrl,
                streamKey: liveInput.streamKey,
                webRTCUrl: liveInput.webRTCUrl,
                playbackUrl: liveInput.playbackUrl,
                hlsUrl: cloudflareStreamService.getHLSUrl(liveInput.liveInputId),
                dashUrl: cloudflareStreamService.getDASHUrl(liveInput.liveInputId)
            }
        });
    } catch (error) {
        console.error('Error creating live stream:', error);
        res.status(500).json({ 
            error: 'Failed to create live stream',
            message: error.message 
        });
    }
};

/**
 * Start a live stream (mark as live)
 */
const startLiveStream = async (req, res) => {
    const { productId } = req.body;

    if (!productId) {
        return res.status(400).json({ error: 'Product ID is required' });
    }

    try {
        // Check if product has live stream setup
        const product = await db.query(
            'SELECT live_input_id, is_live FROM products WHERE product_id = $1',
            [productId]
        );

        if (product.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        if (!product.rows[0].live_input_id) {
            return res.status(400).json({ error: 'No live stream configured for this product' });
        }

        // Update product to mark as live
        await db.query(
            'UPDATE products SET is_live = true, updated_at = NOW() WHERE product_id = $1',
            [productId]
        );

        res.json({
            success: true,
            message: 'Live stream started successfully',
            data: {
                productId,
                isLive: true
            }
        });
    } catch (error) {
        console.error('Error starting live stream:', error);
        res.status(500).json({ 
            error: 'Failed to start live stream',
            message: error.message 
        });
    }
};

/**
 * Stop a live stream
 */
const stopLiveStream = async (req, res) => {
    const { productId } = req.body;

    if (!productId) {
        return res.status(400).json({ error: 'Product ID is required' });
    }

    try {
        // Update product to mark as not live and clear streaming data
        const result = await db.query(
            `UPDATE products 
             SET is_live = false, 
                 live_input_id = NULL, 
                 stream_key = NULL, 
                 rtmp_url = NULL, 
                 product_live_url = NULL,
                 updated_at = NOW() 
             WHERE product_id = $1 
             RETURNING *`,
            [productId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        // Get the live_input_id before it's cleared
        const liveInputId = result.rows[0].live_input_id;
        
        // If there was a live input, attempt to delete it from Cloudflare
        if (liveInputId) {
            try {
                await cloudflareStreamService.deleteLiveInput(liveInputId);
            } catch (error) {
                console.error('Error deleting live input from Cloudflare:', error);
                // Continue even if deletion fails, as we've already cleared the database
            }
        }

        res.json({
            success: true,
            message: 'Live stream stopped successfully',
            data: {
                productId,
                isLive: false
            }
        });
    } catch (error) {
        console.error('Error stopping live stream:', error);
        res.status(500).json({ 
            error: 'Failed to stop live stream',
            message: error.message 
        });
    }
};

/**
 * Get live stream details for a product
 */
const getLiveStreamDetails = async (req, res) => {
    const { productId } = req.params;

    if (!productId) {
        return res.status(400).json({ error: 'Product ID is required' });
    }

    try {
        const result = await db.query(
            `SELECT product_id, name, live_input_id, stream_key, rtmp_url, is_live, updated_at
             FROM products 
             WHERE product_id = $1`,
            [productId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const product = result.rows[0];

        if (!product.live_input_id) {
            return res.status(404).json({ error: 'No live stream configured for this product' });
        }

        res.json({
            success: true,
            data: {
                productId: product.product_id,
                productName: product.name,
                liveInputId: product.live_input_id,
                rtmpUrl: product.rtmp_url,
                streamKey: product.stream_key,
                isLive: product.is_live,
                playbackUrl: cloudflareStreamService.getPlaybackUrl(product.live_input_id),
                hlsUrl: cloudflareStreamService.getHLSUrl(product.live_input_id),
                dashUrl: cloudflareStreamService.getDASHUrl(product.live_input_id),
                updatedAt: product.updated_at
            }
        });
    } catch (error) {
        console.error('Error getting live stream details:', error);
        res.status(500).json({ 
            error: 'Failed to get live stream details',
            message: error.message 
        });
    }
};

/**
 * Delete a live stream
 */
const deleteLiveStream = async (req, res) => {
    const { productId } = req.params;

    if (!productId) {
        return res.status(400).json({ error: 'Product ID is required' });
    }

    try {
        // Get live input ID
        const product = await db.query(
            'SELECT live_input_id FROM products WHERE product_id = $1',
            [productId]
        );

        if (product.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const liveInputId = product.rows[0].live_input_id;

        if (!liveInputId) {
            return res.status(404).json({ error: 'No live stream configured for this product' });
        }

        // Delete from Cloudflare
        await cloudflareStreamService.deleteLiveInput(liveInputId);

        // Clear live stream data from product
        await db.query(
            `UPDATE products 
             SET live_input_id = NULL, 
                 stream_key = NULL, 
                 rtmp_url = NULL, 
                 is_live = false,
                 updated_at = NOW()
             WHERE product_id = $1`,
            [productId]
        );

        res.json({
            success: true,
            message: 'Live stream deleted successfully',
            data: {
                productId
            }
        });
    } catch (error) {
        console.error('Error deleting live stream:', error);
        res.status(500).json({ 
            error: 'Failed to delete live stream',
            message: error.message 
        });
    }
};

/**
 * Get WebRTC connection URL for browser-based streaming
 */
const getWebRTCUrl = async (req, res) => {
    const { productId } = req.params;

    if (!productId) {
        return res.status(400).json({ error: 'Product ID is required' });
    }

    try {
        const product = await db.query(
            'SELECT live_input_id FROM products WHERE product_id = $1',
            [productId]
        );

        if (product.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const liveInputId = product.rows[0].live_input_id;

        if (!liveInputId) {
            return res.status(404).json({ error: 'No live stream configured for this product' });
        }

        const webRTCUrl = await cloudflareStreamService.getWebRTCUrl(liveInputId);

        if (!webRTCUrl) {
            // WebRTC not available, return RTMP details instead
            const productDetails = await db.query(
                'SELECT rtmp_url, stream_key FROM products WHERE product_id = $1',
                [productId]
            );

            return res.json({
                success: true,
                data: {
                    productId,
                    webRTCUrl: null,
                    rtmpUrl: productDetails.rows[0].rtmp_url,
                    streamKey: productDetails.rows[0].stream_key,
                    message: 'WebRTC not available, use RTMP streaming instead'
                }
            });
        }

        res.json({
            success: true,
            data: {
                productId,
                webRTCUrl
            }
        });
    } catch (error) {
        console.error('Error getting WebRTC URL:', error);
        res.status(500).json({ 
            error: 'Failed to get WebRTC URL',
            message: error.message 
        });
    }
};

/**
 * Get all live products
 */
const getAllLiveProducts = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT product_id, name, live_input_id, is_live, image_path, starting_price, bid_amount
             FROM products 
             WHERE is_live = true AND live_input_id IS NOT NULL
             ORDER BY updated_at DESC`
        );

        const liveProducts = result.rows.map(product => ({
            productId: product.product_id,
            productName: product.name,
            liveInputId: product.live_input_id,
            isLive: product.is_live,
            imagePath: product.image_path,
            startingPrice: product.starting_price,
            currentBid: product.bid_amount,
            playbackUrl: cloudflareStreamService.getPlaybackUrl(product.live_input_id),
            hlsUrl: cloudflareStreamService.getHLSUrl(product.live_input_id)
        }));

        res.json({
            success: true,
            count: liveProducts.length,
            data: liveProducts
        });
    } catch (error) {
        console.error('Error getting live products:', error);
        res.status(500).json({ 
            error: 'Failed to get live products',
            message: error.message 
        });
    }
};

module.exports = {
    createLiveStream,
    startLiveStream,
    stopLiveStream,
    getLiveStreamDetails,
    deleteLiveStream,
    getWebRTCUrl,
    getAllLiveProducts
};
