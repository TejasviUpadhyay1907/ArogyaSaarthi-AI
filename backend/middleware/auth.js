/**
 * Firebase Admin auth middleware for ArogyaSaarthi AI
 * Verifies Bearer token on every protected route.
 * Attaches decoded user to req.user = { uid, email, emailVerified }
 */
const admin = require('../firebase-admin');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: missing token' });
  }

  const token = header.slice(7);
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = {
      uid:           decoded.uid,
      email:         decoded.email || null,
      emailVerified: decoded.email_verified || false,
    };
    next();
  } catch (err) {
    console.warn('[Auth] Token verification failed:', err.code || err.message);
    return res.status(401).json({ error: 'Unauthorized: invalid or expired token' });
  }
}

module.exports = { requireAuth };
