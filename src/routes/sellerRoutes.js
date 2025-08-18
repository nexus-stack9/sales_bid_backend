const express = require('express');
const router = express.Router();
const { 
    getAllSellers, 
    createSeller} = require('../controller/sellerController');
// Product routes
router.get('/', getAllSellers);
router.post('/addSeller', createSeller);



module.exports = router;