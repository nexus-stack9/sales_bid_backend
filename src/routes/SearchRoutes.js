const express = require('express');
const router = express.Router();
const { searchProducts, getSearchSuggestions } = require('../controller/SearchController');

// Main product search endpoint
router.get('/find', searchProducts);

// Search suggestions/autocomplete endpoint
router.get('/suggestions', getSearchSuggestions);

module.exports = router;