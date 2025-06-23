const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { config } = require("./config/config");
const db = require("./db/database");
const bodyParser = require('body-parser');
const http = require('http');
const WebSocket = require('ws');
const { initProductWebSocket } = require('./controller/ProductController');

const app = express();

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server, path: '/ws/product' });

// Initialize WebSocket handlers
initProductWebSocket(wss);

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(bodyParser.json());

// Routes
app.use("/api", require("./routes/router"));
app.use('/auth', require('./routes/loginRoutes'));
app.use('/file', require('./routes/fileRoutes'));
app.use('/password', require('./routes/passwordResetRoutes')); // Add password reset routes
app.use('/profile', require('./routes/profileRoutes')); 
app.use('/bids', require('./routes/BidsRoute'));
app.use("/global", require("./routes/globalRoutes"));


// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Start server
const PORT = config.port || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${PORT}/ws/product`);
  db.connect()
    .then(() => console.log("Database connected successfully"))
    .catch((err) => console.error("Database connection error:", err));
});