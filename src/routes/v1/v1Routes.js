const express = require("express");
const router = express.Router();
const fileRoutes = require("../fileRoutes");
const productRoutes = require("../ProductRoute");

// API routes
router.get("/", (req, res) => {
  res.json({
    message: "Welcome to B-Stock API v1",
    version: "1.0.0",
  });
});

// File routes
router.use("/files", fileRoutes);

// Product and wishlist routes
router.use("/products", productRoutes);

module.exports = router;