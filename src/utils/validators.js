const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidDiscordId = (id) => {
  return /^\d{15,21}$/.test(id);
};

const isValidRating = (rating) => {
  return rating >= 0 && rating <= 100;
};

const isValidMarketValue = (value) => {
  return value >= 0 && Number.isFinite(value);
};

const formatMarketValue = (value) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
};

module.exports = {
  isValidEmail,
  isValidDiscordId,
  isValidRating,
  isValidMarketValue,
  formatMarketValue,
};
