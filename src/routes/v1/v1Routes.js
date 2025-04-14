const express = require("express");
const router = express.Router();

// TODO: Add your API routes here
router.get("/", (req, res) => {
  res.json({
    message: "Welcome to B-Stock API v1",
    version: "1.0.0",
  });
});

module.exports = router;