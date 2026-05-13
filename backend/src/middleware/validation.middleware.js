const AppError = require('../utils/AppError');

const validateRequest = (schema, source = 'body') => (req, res, next) => {
  const validationTarget = req[source] || {};
  const { error, value } = schema.validate(validationTarget, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const message = error.details.map((detail) => detail.message).join('; ');
    return next(new AppError(message, 400));
  }

  req[source] = value;
  next();
};

module.exports = { validateRequest };
