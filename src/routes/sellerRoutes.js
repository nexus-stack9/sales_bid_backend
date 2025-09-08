const express = require('express');
const router = express.Router();
const { 
    getAllSellers, 
    createSeller,updateSellerPath} = require('../controller/sellerController');
// Product routes
router.get('/', getAllSellers);
router.post('/addSeller', createSeller);
router.put('/updatePaath/:id', updateSellerPath);



module.exports = router;