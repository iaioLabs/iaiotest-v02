/**
 * authMiddleware.js — iaio Test v2
 *
 * Simple bearer token guard for mutation endpoints.
 * Set API_SECRET in secrets .env. If unset, warns and passes through (dev only).
 */

function requireAuth(req, res, next) {
  const API_SECRET = process.env.API_SECRET

  if (!API_SECRET) {
    console.warn('[auth] API_SECRET not set — endpoint is unprotected!')
    return next()
  }

  const authHeader = req.headers['authorization'] || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null

  if (!token || token !== API_SECRET) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  next()
}

module.exports = { requireAuth }
