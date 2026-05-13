const mongoose = require('mongoose');
const { mongoUri } = require('./config');
const logger = require('./logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(mongoUri);
    logger.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    logger.error('MongoDB connection error', { message: err.message });
    // In Serverless environments, don't exit the process. Let the requests fail with detailed DB errors.
  }
};

module.exports = connectDB;
