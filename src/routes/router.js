const express = require("express");
const router = express.Router();

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

// Example of versioned API routes
router.use("/v1", require("./v1/v1Routes"));

module.exports = router;
