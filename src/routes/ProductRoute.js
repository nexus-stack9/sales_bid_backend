const express = require('express');
const router = express.Router();
const { 
    getAllProducts, 
    getProductByUid, 
    addToWishlist, 
    removeFromWishlist, 
    getWishlistByUserId 
} = require('../controller/ProductController');
// const { authMiddleware } = require('../middleware/authMiddleware');

// Product routes
router.get('/', getAllProducts);
router.get('/:uid', getProductByUid);

// Wishlist routes - protected with authentication
router.post('/wishlist/add', addToWishlist);
router.post('/wishlist/remove', removeFromWishlist);
router.get('/wishlist/user/:user_id', getWishlistByUserId);

module.exports = router;