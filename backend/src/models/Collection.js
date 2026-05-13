const mongoose = require('mongoose');
const COLORS = ['gray', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink'];

const collectionSchema = new mongoose.Schema({
  user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:  { type: String, required: true, trim: true, maxlength: 60 },
  color: { type: String, enum: COLORS, default: 'blue' },
  icon:  { type: String, default: '📁', maxlength: 4 },
}, { timestamps: true });

collectionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.models.Collection || mongoose.model('Collection', collectionSchema);
