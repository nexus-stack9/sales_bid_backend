const express = require('express');
const router = express.Router();
const { 
    getAllProducts, 
    getProductByUid, 
    addProduct,
    addToWishlist, 
    removeFromWishlist, 
} = require('../controller/ProductController');
// const { authMiddleware } = require('../middleware/authMiddleware');

// Product routes
router.get('/', getAllProducts);
router.get('/:uid', getProductByUid);
router.post('/', addProduct);
router.post('/addProduct', addProduct);

// Wishlist routes - protected with authentication
router.post('/wishlist/add', addToWishlist);
router.post('/wishlist/remove', removeFromWishlist);

module.exports = router;