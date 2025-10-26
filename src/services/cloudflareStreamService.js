const axios = require('axios');

class CloudflareStreamService {
    constructor() {
        this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        this.apiToken = process.env.CLOUDFLARE_API_TOKEN;
        this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/stream`;
    }

    /**
     * Create a new live input for streaming
     * @param {string} productId - The product ID associated with the stream
     * @param {string} productName - The product name for the stream
     * @returns {Promise<Object>} Live input details including RTMP URL and stream key
     */
    async createLiveInput(productId, productName) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/live_inputs`,
                {
                    meta: {
                        name: `${productName} - Product ${productId}`
                    },
                    recording: {
                        mode: 'automatic'
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.success) {
                const liveInput = response.data.result;
                
                // Get WHIP URL for WebRTC ingestion
                const whipUrl = liveInput.webRTC?.url || null;
                
                // Extract the base URL from HLS manifest if available
                // Cloudflare returns URLs like: https://customer-xxx.cloudflarestream.com/{uid}/manifest/video.m3u8
                let baseUrl = `https://customer-${this.accountId}.cloudflarestream.com`;
                
                // Try to get the actual customer subdomain from the response
                if (liveInput.playback?.hls) {
                    const hlsUrl = liveInput.playback.hls;
                    const match = hlsUrl.match(/(https:\/\/customer-[^\/]+\.cloudflarestream\.com)/);
                    if (match) {
                        baseUrl = match[1];
                    }
                }
                
                return {
                    liveInputId: liveInput.uid,
                    rtmpUrl: liveInput.rtmps?.url || liveInput.rtmp?.url,
                    streamKey: liveInput.rtmps?.streamKey || liveInput.rtmp?.streamKey,
                    webRTCUrl: whipUrl, // WHIP URL for broadcasting
                    whipUrl: whipUrl,
                    whepUrl: liveInput.webRTC?.playbackUrl || null, // WHEP URL for playback
                    playbackUrl: liveInput.playback?.hls || `${baseUrl}/${liveInput.uid}/iframe`,
                    hlsUrl: liveInput.playback?.hls || `${baseUrl}/${liveInput.uid}/manifest/video.m3u8`,
                    dashUrl: liveInput.playback?.dash || `${baseUrl}/${liveInput.uid}/manifest/video.mpd`
                };
            } else {
                throw new Error('Failed to create live input: ' + JSON.stringify(response.data.errors));
            }
        } catch (error) {
            console.error('Error creating live input:', error.response?.data || error.message);
            throw new Error('Failed to create live input: ' + (error.response?.data?.errors?.[0]?.message || error.message));
        }
    }

    /**
     * Get live input details
     * @param {string} liveInputId - The live input ID
     * @returns {Promise<Object>} Live input details
     */
    async getLiveInput(liveInputId) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/live_inputs/${liveInputId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`
                    }
                }
            );

            if (response.data.success) {
                return response.data.result;
            } else {
                throw new Error('Failed to get live input');
            }
        } catch (error) {
            console.error('Error getting live input:', error.response?.data || error.message);
            throw new Error('Failed to get live input: ' + error.message);
        }
    }

    /**
     * Delete a live input
     * @param {string} liveInputId - The live input ID to delete
     * @returns {Promise<boolean>} Success status
     */
    async deleteLiveInput(liveInputId) {
        try {
            const response = await axios.delete(
                `${this.baseUrl}/live_inputs/${liveInputId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`
                    }
                }
            );

            return response.data.success;
        } catch (error) {
            console.error('Error deleting live input:', error.response?.data || error.message);
            throw new Error('Failed to delete live input: ' + error.message);
        }
    }

    /**
     * Get WebRTC WHIP URL for browser-based streaming
     * @param {string} liveInputId - The live input ID
     * @returns {Promise<string>} WHIP URL for WebRTC ingestion
     */
    async getWebRTCUrl(liveInputId) {
        try {
            // Get the live input details to retrieve WHIP URL
            const liveInputResponse = await axios.get(
                `${this.baseUrl}/live_inputs/${liveInputId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`
                    }
                }
            );

            if (!liveInputResponse.data.success) {
                throw new Error('Failed to get live input details');
            }

            const liveInput = liveInputResponse.data.result;
            
            // Return WHIP URL for WebRTC ingestion
            if (liveInput.webRTC && liveInput.webRTC.url) {
                return liveInput.webRTC.url; // This is the WHIP URL
            }

            // WebRTC not available
            console.warn('WebRTC (WHIP) not available for this live input');
            return null;
        } catch (error) {
            console.error('Error getting WebRTC URL:', error.response?.data || error.message);
            
            // If WebRTC is not supported, return null and let the frontend handle RTMP
            if (error.response?.status === 404 || error.response?.status === 400) {
                console.warn('WebRTC not available for this live input, falling back to RTMP');
                return null;
            }
            
            throw new Error('Failed to get WebRTC URL: ' + error.message);
        }
    }

    /**
     * Get the playback URL for a live stream
     * @param {string} liveInputId - The live input ID
     * @returns {string} Playback URL
     */
    getPlaybackUrl(liveInputId) {
        return `https://customer-${this.accountId}.cloudflarestream.com/${liveInputId}/iframe`;
    }

    /**
     * Get the HLS manifest URL for a live stream
     * @param {string} liveInputId - The live input ID
     * @returns {string} HLS manifest URL
     */
    getHLSUrl(liveInputId) {
        return `https://customer-${this.accountId}.cloudflarestream.com/${liveInputId}/manifest/video.m3u8`;
    }

    /**
     * Get the DASH manifest URL for a live stream
     * @param {string} liveInputId - The live input ID
     * @returns {string} DASH manifest URL
     */
    getDASHUrl(liveInputId) {
        return `https://customer-${this.accountId}.cloudflarestream.com/${liveInputId}/manifest/video.mpd`;
    }
}

module.exports = new CloudflareStreamService();
