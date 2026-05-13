const mongoose = require('mongoose');

const promptTemplateSchema = new mongoose.Schema({
  // null = system/predefined template; ObjectId = user-owned template
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  name:        { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 300, default: '' },

  type: {
    type: String,
    enum: ['blog', 'ad', 'caption', 'product_description', 'email', 'tagline'],
    required: true,
  },
  tone: {
    type: String,
    enum: ['professional', 'casual', 'marketing', 'funny', 'formal'],
    default: 'professional',
  },
  length:   { type: String, enum: ['short', 'medium', 'long'], default: 'medium' },
  language: { type: String, default: 'English', trim: true },
  keywords: { type: [String], default: [] },

  // The actual prompt text
  prompt: { type: String, required: true, maxlength: 500 },

  // Version history — each edit appends here
  versions: [{
    prompt:    { type: String, required: true },
    editedAt:  { type: Date, default: Date.now },
    note:      { type: String, default: '' },
  }],

  isSystem:   { type: Boolean, default: false },
  usageCount: { type: Number, default: 0 },
}, { timestamps: true });

promptTemplateSchema.index({ user: 1, createdAt: -1 });
promptTemplateSchema.index({ isSystem: 1, type: 1 });

module.exports = mongoose.models.PromptTemplate || mongoose.model('PromptTemplate', promptTemplateSchema);
