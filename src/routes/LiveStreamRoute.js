const express = require('express');
const router = express.Router();
const {
    createLiveStream,
    startLiveStream,
    stopLiveStream,
    getLiveStreamDetails,
    deleteLiveStream,
    getWebRTCUrl,
    getAllLiveProducts
} = require('../controller/LiveStreamController');

// Create a new live stream for a product
router.post('/create', createLiveStream);

// Start a live stream
router.post('/start', startLiveStream);

// Stop a live stream
router.post('/stop', stopLiveStream);

// Get live stream details for a product
router.get('/:productId', getLiveStreamDetails);

// Delete a live stream
router.delete('/:productId', deleteLiveStream);

// Get WebRTC URL for browser-based streaming
router.get('/:productId/webrtc', getWebRTCUrl);

// Get all live products
router.get('/live/all', getAllLiveProducts);

module.exports = router;
