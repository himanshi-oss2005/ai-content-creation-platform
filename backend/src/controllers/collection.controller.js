const mongoose   = require('mongoose');
const Collection = require('../models/Collection');
const Content    = require('../models/Content');
const asyncHandler = require('../utils/asyncHandler');
const AppError   = require('../utils/AppError');

// GET /api/collections — list user's collections with item counts
exports.listCollections = asyncHandler(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(String(req.user._id));

  const [collections, counts] = await Promise.all([
    Collection.find({ user: userId }).sort({ createdAt: -1 }).lean(),
    Content.aggregate([
      { $match: { user: userId, collectionId: { $ne: null } } },
      { $group: { _id: '$collectionId', count: { $sum: 1 } } },
    ]),
  ]);

  const countMap = Object.fromEntries(counts.map((c) => [c._id.toString(), c.count]));
  const result   = collections.map((c) => ({ ...c, itemCount: countMap[c._id.toString()] ?? 0 }));

  res.json({ collections: result });
});

// POST /api/collections
exports.createCollection = asyncHandler(async (req, res) => {
  const sanitize = (v) => (typeof v === 'string' ? v.trim() : undefined);
  const name  = sanitize(req.body.name);
  const color = sanitize(req.body.color);
  const icon  = sanitize(req.body.icon);
  const userId = new mongoose.Types.ObjectId(String(req.user._id));

  const collection = await Collection.create({ user: userId, name, color, icon });
  res.status(201).json({ collection: { ...collection.toObject(), itemCount: 0 } });
});

// PATCH /api/collections/:id — rename / recolor
exports.updateCollection = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new AppError('Invalid collection ID', 400);

  const sanitize = (v) => (typeof v === 'string' ? v.trim() : undefined);
  const name  = sanitize(req.body.name);
  const color = sanitize(req.body.color);
  const icon  = sanitize(req.body.icon);

  const updateFields = {};
  if (name)  updateFields.name  = name;
  if (color) updateFields.color = color;
  if (icon)  updateFields.icon  = icon;

  if (!Object.keys(updateFields).length) throw new AppError('No valid fields to update', 400);

  const userId = new mongoose.Types.ObjectId(String(req.user._id));

  const collection = await Collection.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(String(req.params.id)), user: userId },
    { $set: updateFields },
    { new: true, runValidators: true, lean: true }
  );
  if (!collection) throw new AppError('Collection not found', 404);

  const itemCount = await Content.countDocuments({ user: userId, collectionId: collection._id });
  res.json({ collection: { ...collection, itemCount } });
});

// DELETE /api/collections/:id — removes collection, un-assigns all content
exports.deleteCollection = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new AppError('Invalid collection ID', 400);
  const collectionId = new mongoose.Types.ObjectId(String(req.params.id));
  const userId        = new mongoose.Types.ObjectId(String(req.user._id));

  const collection = await Collection.findOneAndDelete({ _id: collectionId, user: userId }).lean();
  if (!collection) throw new AppError('Collection not found', 404);

  // Un-assign all content that belonged to this collection
  await Content.updateMany(
    { user: userId, collection: collectionId },
    { $set: { collection: null } }
  );

  res.json({ message: 'Collection deleted' });
});

// PATCH /api/content/:id/collection — assign or un-assign a content item
exports.assignCollection = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new AppError('Invalid content ID', 400);
  const contentId = new mongoose.Types.ObjectId(String(req.params.id));
  const userId    = new mongoose.Types.ObjectId(String(req.user._id));

  const { collectionId } = req.body;
  let safeCollectionId = null;

  if (collectionId) {
    if (!mongoose.Types.ObjectId.isValid(collectionId)) throw new AppError('Invalid collection ID', 400);
    safeCollectionId = new mongoose.Types.ObjectId(String(collectionId));
    const col = await Collection.findOne({ _id: safeCollectionId, user: userId }).lean();
    if (!col) throw new AppError('Collection not found', 404);
  }

  const content = await Content.findOneAndUpdate(
    { _id: contentId, user: userId },
    { $set: { collection: safeCollectionId } },
    { new: true, lean: true }
  );
  if (!content) throw new AppError('Content not found', 404);

  res.json({ collection: content.collection });
});
