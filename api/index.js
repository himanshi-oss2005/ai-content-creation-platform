const mongoose = require('mongoose');
const app = require('../backend/src/app');
const connectDB = require('../backend/src/utils/db');

// Connect to DB once when function is initialized
if (mongoose.connection.readyState === 0) {
  connectDB();
}

module.exports = app;
