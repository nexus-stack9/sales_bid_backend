const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { config } = require("./config/config");
const db = require("./db/database");
const bodyParser = require('body-parser');

const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(bodyParser.json());
// Routes
app.use("/api", require("./routes/router"));
app.use('/auth', require('./routes/loginRoutes'));


// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Start server
const PORT = config.port || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  db.connect()
    .then(() => console.log("Database connected successfully"))
    .catch((err) => console.error("Database connection error:", err));
});
