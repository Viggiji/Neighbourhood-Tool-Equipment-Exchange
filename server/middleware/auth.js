const jwt = require('jsonwebtoken');

/**
 * JWT authentication middleware.
 * Extracts the token from the Authorization header and verifies it.
 * Attaches the decoded user payload to req.user on success.
 */
function authenticateToken(req, res, next) {
  const token = req.cookies?.token || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
}

module.exports = { authenticateToken };
