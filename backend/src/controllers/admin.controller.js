const mongoose      = require('mongoose');
const User          = require('../models/User');
const Content       = require('../models/Content');
const asyncHandler  = require('../utils/asyncHandler');
const AppError      = require('../utils/AppError');
const analytics     = require('../services/analytics.service');

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function buildSearchFilter(rawSearch) {
  if (!rawSearch || typeof rawSearch !== 'string') return {};
  const safe = escapeRegExp(rawSearch.trim().slice(0, 100));
  if (!safe) return {};
  return {
    $or: [
      { name:  { $regex: safe, $options: 'i' } },
      { email: { $regex: safe, $options: 'i' } },
    ],
  };
}

// GET /api/admin/stats — platform-wide overview
exports.getStats = asyncHandler(async (req, res) => {
  try {
    const [totalUsers, premiumUsers, totalContent, sourceBreakdown] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'premium' }),
      Content.countDocuments(),
      Content.aggregate([
        { $group: { _id: '$source', count: { $sum: 1 } } },
      ]),
    ]);

    return res.json({
      totalUsers,
      premiumUsers,
      freeUsers: totalUsers - premiumUsers,
      totalContent,
      sourceBreakdown,
      realtime: analytics.getStats(),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// GET /api/admin/users — paginated user list
exports.getUsers = asyncHandler(async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(String(req.query.page  ?? '1'), 10) || 1);
    const limit = Math.min(50, parseInt(String(req.query.limit ?? '20'), 10) || 20);
    const searchFilter = buildSearchFilter(req.query.search);

    const [users, total] = await Promise.all([
      User.find(searchFilter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(searchFilter),
    ]);

    return res.json({ users, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PATCH /api/admin/users/:id/role — upgrade or downgrade a user
exports.updateUserRole = asyncHandler(async (req, res) => {
  try {
    const { role } = req.body;
    const targetUserId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (!['free', 'premium'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (req.user && req.user._id.toString() === targetUserId) {
      return res.status(403).json({ error: 'Cannot modify your own role' });
    }

    const user = await User.findByIdAndUpdate(
      targetUserId,
      { role, subscriptionStatus: role === 'premium' ? 'active' : 'inactive' },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update user role' });
  }
});

// GET /api/admin/analytics — real-time generation analytics
exports.getAnalytics = asyncHandler(async (req, res) => {
  try {
    return res.json(analytics.getStats());
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});
