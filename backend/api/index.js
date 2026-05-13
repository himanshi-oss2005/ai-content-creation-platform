const mongoose = require('mongoose');
const app = require('../src/app');
const connectDB = require('../src/utils/db');

if (mongoose.connection.readyState === 0) {
  connectDB();
}

module.exports = app;
