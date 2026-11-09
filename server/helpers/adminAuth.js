/**
 * Guards endpoints that change scores, points or match data by hand.
 * They used to be open to anyone, which let any visitor post fake scores or points.
 * They now require an "x-admin-key" header equal to the ADMIN_KEY environment
 * variable, and are disabled entirely when ADMIN_KEY is not set.
 */
const crypto = require('crypto');

const requireAdmin = (req, res, next) => {
  const expected = process.env.ADMIN_KEY;
  const given = req.header('x-admin-key') || '';
  if (!expected) {
    return res.status(403).json({ error: 'This endpoint is disabled.' });
  }
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

module.exports = { requireAdmin };
