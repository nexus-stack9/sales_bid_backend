const db = require('../db/database');

// Search products by optional filters: name, vendor_name, condition, category_name
// Endpoint suggestion: GET /v1/products/search?name=...&vendor_name=...&condition=...&category_name=...
const searchProducts = async (req, res) => {
  try {
    const { q: searchQuery, condition, location, category_name, vendor_name, limit = 50, offset = 0 } = req.query;

    // Base query from the view
    let query = `
      SELECT * FROM vw_products_with_bid_stats 
      WHERE 1=1
    `;
    const values = [];
    let paramCount = 0;

    // Helper function to add parameter
    const addParam = (value) => {
      paramCount++;
      values.push(value);
      return `$${paramCount}`;
    };

    // If there's a general search query, parse it intelligently
    if (searchQuery && searchQuery.trim()) {
      const searchTerms = parseSearchQuery(searchQuery.trim());
      
      // Build comprehensive search conditions
      const searchConditions = [];
      
      // Search in main fields for each term
      searchTerms.mainTerms.forEach(term => {
        const termParam = addParam(`%${term}%`);
        searchConditions.push(`(
          name ILIKE ${termParam} OR 
          description ILIKE ${termParam} OR 
          category_name ILIKE ${termParam} OR 
          vendor_name ILIKE ${termParam} OR
          tags ILIKE ${termParam}
        )`);
      });
      
      // Add location conditions if detected
      if (searchTerms.locations.length > 0) {
        const locationConditions = searchTerms.locations.map(loc => {
          const locParam = addParam(`%${loc}%`);
          return `location ILIKE ${locParam}`;
        });
        searchConditions.push(`(${locationConditions.join(' OR ')})`);
      }
      
      // Add condition filters if detected
      if (searchTerms.conditions.length > 0) {
        const conditionConditions = searchTerms.conditions.map(cond => {
          const condParam = addParam(`%${cond}%`);
          return `condition ILIKE ${condParam}`;
        });
        searchConditions.push(`(${conditionConditions.join(' OR ')})`);
      }
      
      // Combine all search conditions
      if (searchConditions.length > 0) {
        query += ` AND (${searchConditions.join(' AND ')})`;
      }
    }

    // Apply specific filters if provided separately
    if (condition) {
      const condParam = addParam(`%${condition}%`);
      query += ` AND condition ILIKE ${condParam}`;
    }
    
    if (location) {
      const locParam = addParam(`%${location}%`);
      query += ` AND location ILIKE ${locParam}`;
    }
    
    if (category_name) {
      const catParam = addParam(`%${category_name}%`);
      query += ` AND category_name ILIKE ${catParam}`;
    }
    
    if (vendor_name) {
      const vendorParam = addParam(`%${vendor_name}%`);
      query += ` AND vendor_name ILIKE ${vendorParam}`;
    }

    // Add ordering and pagination
    query += ` 
      ORDER BY 
        CASE WHEN status = 'active' THEN 1 ELSE 2 END,
        trending DESC NULLS LAST,
        total_bids DESC,
        auction_end ASC,
        created_at DESC
      LIMIT ${addParam(parseInt(limit))} 
      OFFSET ${addParam(parseInt(offset))}
    `;

    const result = await db.query(query, values);
    
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total FROM view_products_with_bid_stats 
      WHERE 1=1
    `;
    const countValues = values.slice(0, -2); // Remove limit and offset params
    
    // Rebuild the same WHERE conditions for count query
    let countParamIndex = 0;
    if (searchQuery && searchQuery.trim()) {
      const searchTerms = parseSearchQuery(searchQuery.trim());
      const searchConditions = [];
      
      searchTerms.mainTerms.forEach(() => {
        countParamIndex++;
        searchConditions.push(`(
          name ILIKE $${countParamIndex} OR 
          description ILIKE $${countParamIndex} OR 
          category_name ILIKE $${countParamIndex} OR 
          vendor_name ILIKE $${countParamIndex} OR
          tags ILIKE $${countParamIndex}
        )`);
      });
      
      if (searchTerms.locations.length > 0) {
        const locationConditions = searchTerms.locations.map(() => {
          countParamIndex++;
          return `location ILIKE $${countParamIndex}`;
        });
        searchConditions.push(`(${locationConditions.join(' OR ')})`);
      }
      
      if (searchTerms.conditions.length > 0) {
        const conditionConditions = searchTerms.conditions.map(() => {
          countParamIndex++;
          return `condition ILIKE $${countParamIndex}`;
        });
        searchConditions.push(`(${conditionConditions.join(' OR ')})`);
      }
      
      if (searchConditions.length > 0) {
        countQuery += ` AND (${searchConditions.join(' AND ')})`;
      }
    }

    // Add other filters to count query
    if (condition) {
      countParamIndex++;
      countQuery += ` AND condition ILIKE $${countParamIndex}`;
    }
    if (location) {
      countParamIndex++;
      countQuery += ` AND location ILIKE $${countParamIndex}`;
    }
    if (category_name) {
      countParamIndex++;
      countQuery += ` AND category_name ILIKE $${countParamIndex}`;
    }
    if (vendor_name) {
      countParamIndex++;
      countQuery += ` AND vendor_name ILIKE $${countParamIndex}`;
    }

    const countResult = await db.query(countQuery, countValues);
    const totalCount = parseInt(countResult.rows[0].total);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      total: totalCount,
      page: Math.floor(parseInt(offset) / parseInt(limit)) + 1,
      totalPages: Math.ceil(totalCount / parseInt(limit)),
      data: result.rows,
      searchQuery: searchQuery || null,
      appliedFilters: {
        condition: condition || null,
        location: location || null,
        category_name: category_name || null,
        vendor_name: vendor_name || null
      }
    });
  } catch (error) {
    console.error('Error searching products:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search products',
      error: error.message,
    });
  }
};

// Helper function to intelligently parse search queries
const parseSearchQuery = (searchQuery) => {
  const query = searchQuery.toLowerCase();
  
  // Common condition keywords (dynamically expandable)
  const conditionKeywords = [
    'new', 'used', 'refurbished', 'excellent', 'good', 'fair', 'poor',
    'mint', 'like new', 'very good', 'acceptable', 'damaged',
    'sealed', 'open box', 'certified', 'renewed'
  ];
  
  // Common location indicators (dynamically expandable)
  const locationKeywords = [
    'in', 'at', 'from', 'near', 'around', 'located'
  ];
  
  // Extract potential locations (words after location indicators)
  const locations = [];
  const locationRegex = /\b(?:in|at|from|near|around|located)\s+([a-zA-Z\s]+?)(?:\s|$)/gi;
  let locationMatch;
  while ((locationMatch = locationRegex.exec(query)) !== null) {
    const location = locationMatch[1].trim();
    if (location && location.length > 2) {
      locations.push(location);
    }
  }
  
  // Extract conditions
  const conditions = [];
  conditionKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(query)) {
      conditions.push(keyword);
    }
  });
  
  // Extract main search terms (remove location indicators and conditions)
  let cleanQuery = query;
  
  // Remove location phrases
  cleanQuery = cleanQuery.replace(/\b(?:in|at|from|near|around|located)\s+[a-zA-Z\s]+/gi, '');
  
  // Remove condition words
  conditionKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    cleanQuery = cleanQuery.replace(regex, '');
  });
  
  // Extract main terms (non-empty words)
  const mainTerms = cleanQuery
    .split(/\s+/)
    .map(term => term.trim())
    .filter(term => term.length > 2); // Filter out very short terms
  
  return {
    mainTerms: [...new Set(mainTerms)], // Remove duplicates
    locations: [...new Set(locations)], // Remove duplicates
    conditions: [...new Set(conditions)] // Remove duplicates
  };
};

// Additional helper function to get search suggestions
const getSearchSuggestions = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Query must be at least 2 characters long'
      });
    }
    
    const searchTerm = `%${q.trim()}%`;
    
    const suggestionQuery = `
      SELECT DISTINCT 
        name,
        category_name,
        vendor_name,
        location,
        condition
      FROM view_products_with_bid_stats 
      WHERE 
        name ILIKE $1 OR 
        category_name ILIKE $1 OR 
        vendor_name ILIKE $1 OR
        location ILIKE $1 OR
        condition ILIKE $1
      LIMIT 10
    `;
    
    const result = await db.query(suggestionQuery, [searchTerm]);
    
    // Extract unique suggestions
    const suggestions = new Set();
    
    result.rows.forEach(row => {
      if (row.name && row.name.toLowerCase().includes(q.toLowerCase())) {
        suggestions.add(row.name);
      }
      if (row.category_name && row.category_name.toLowerCase().includes(q.toLowerCase())) {
        suggestions.add(row.category_name);
      }
      if (row.vendor_name && row.vendor_name.toLowerCase().includes(q.toLowerCase())) {
        suggestions.add(row.vendor_name);
      }
      if (row.location && row.location.toLowerCase().includes(q.toLowerCase())) {
        suggestions.add(`in ${row.location}`);
      }
      if (row.condition && row.condition.toLowerCase().includes(q.toLowerCase())) {
        suggestions.add(`${row.condition} condition`);
      }
    });
    
    return res.status(200).json({
      success: true,
      suggestions: Array.from(suggestions).slice(0, 8)
    });
    
  } catch (error) {
    console.error('Error getting search suggestions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get suggestions',
      error: error.message
    });
  }
};

module.exports = {
  searchProducts,
  getSearchSuggestions
};

