const Joi = require('joi');
const logger = require('../config/logger');

const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message,
      }));
      logger.warn('Validation error:', details);
      return res.status(400).json({ errors: details });
    }

    req.validatedData = value;
    next();
  };
};

module.exports = { validate };
