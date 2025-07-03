const express = require('express');
const router = express.Router();
const { 
    addWishlistItem, 
    deleteWishlistItem, 
    checkWishlistItem, 
    getWishlistByUserId,
    getUserWishlistDetails 
} = require('../controller/WishlistController');

/**
 * @route   POST /api/wishlist/addToWishlist
 * @desc    Add a product to user's wishlist
 * @access  Private (assuming this requires authentication)
 */
router.post('/addToWishlist', addWishlistItem);

/**
 * @route   DELETE /api/wishlist/removeFromWishlist
 * @desc    Remove a product from user's wishlist
 * @access  Private (assuming this requires authentication)
 */
router.delete('/removeFromWishlist', deleteWishlistItem);

/**
 * @route   GET /api/wishlist/checkWishlistItem
 * @desc    Check if a product exists in user's wishlist
 * @access  Private (assuming this requires authentication)
 * @query   {string} product_id - The ID of the product to check
 * @query   {string} bidder_id - The ID of the user (bidder)
 * @returns {Object} Object with exists (boolean) and item (wishlist item or null)
 */
router.post('/checkWishlistItem', checkWishlistItem);
router.get('/getWishlist/:user_id', getUserWishlistDetails);

/**
 * @route   GET /api/wishlist/user-wishlist
 * @desc    Get detailed wishlist information for the authenticated user
 * @access  Private
 */
router.get('/user-wishlist', getUserWishlistDetails);

module.exports = router;