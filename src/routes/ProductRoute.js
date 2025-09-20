const express = require('express');
const router = express.Router();
const { 
    getAllProducts, 
    getProductByUid, 
    addProduct,
    addToWishlist, 
    removeFromWishlist,
    updateProduct,
    deleteProduct,
    readXlsxFromUrl
} = require('../controller/ProductController');
// const { authMiddleware } = require('../middleware/authMiddleware');

// Product routes
router.get('/', getAllProducts);
router.get('/:uid', getProductByUid);
router.post('/', addProduct);
router.post('/addProduct', addProduct);
router.put("/products/:id", updateProduct);
router.delete("/products/:id", deleteProduct);

// Wishlist routes - protected with authentication
router.post('/wishlist/add', addToWishlist);
router.post('/wishlist/remove', removeFromWishlist);

// XLSX file reading route
router.get('/xlsx/read', readXlsxFromUrl);

module.exports = router;