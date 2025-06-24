const express = require('express');
const router = express.Router();
const { 
    getAllProducts, 
    getProductByUid, 
    addToWishlist, 
    removeFromWishlist, 
} = require('../controller/ProductController');
// const { authMiddleware } = require('../middleware/authMiddleware');

// Product routes
router.get('/', getAllProducts);
router.get('/:uid', getProductByUid);

// Wishlist routes - protected with authentication
router.post('/wishlist/add', addToWishlist);
router.post('/wishlist/remove', removeFromWishlist);


module.exports = router;