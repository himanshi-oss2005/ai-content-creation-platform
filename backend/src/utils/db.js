const mongoose = require('mongoose');
const { mongoUri } = require('./config');
const logger = require('./logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(mongoUri);
    logger.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    logger.error('MongoDB connection error', { message: err.message });
    process.exit(1);
  }
};

module.exports = connectDB;
