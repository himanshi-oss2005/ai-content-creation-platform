const User = require('../models/User');
const Transaction = require('../models/Transaction');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  if (!user.password) throw new AppError('Password change not available for OAuth accounts', 400);

  const match = await user.comparePassword(currentPassword);
  if (!match) throw new AppError('Current password is incorrect', 401);

  user.password = newPassword;
  await user.save();

  res.json({ message: 'Password changed successfully' });
});

exports.getProfile = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) throw new AppError('Name is required', 400);

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name: name.trim() },
    { new: true, runValidators: true }
  );
  res.json({ user });
});

// Real-time credit state — called after generation to sync UI
exports.getCredits = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const wasReset = user.resetDailyCreditsIfNeeded();
  if (wasReset) await user.save();

  res.json({
    creditsUsedToday: user.creditsUsedToday,
    dailyLimit: user.getDailyLimit(),
    creditsRemaining: user.getDailyLimit() - user.creditsUsedToday,
    role: user.role,
  });
});

exports.getPromptHistory = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('promptHistory').lean();
  res.json({ history: user.promptHistory || [] });
});

exports.addPromptHistory = asyncHandler(async (req, res) => {
  const { prompt } = req.body;
  const trimmed = String(prompt || '').trim();
  if (!trimmed) throw new AppError('prompt is required', 400);

  await User.findByIdAndUpdate(req.user._id, [
    { $set: { promptHistory: {
      $slice: [
        { $filter: {
          input: { $concatArrays: [[trimmed], '$promptHistory'] },
          cond:  { $ne: ['$$this', trimmed] },
        }},
        10,
      ],
    }}}]
  );
  res.json({ ok: true });
});

exports.getTransactions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const pageNum  = Math.max(1, parseInt(String(page),  10));
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10)));

  const [transactions, total] = await Promise.all([
    Transaction.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Transaction.countDocuments({ user: req.user._id }),
  ]);

  res.json({
    transactions,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum) || 1,
  });
});
