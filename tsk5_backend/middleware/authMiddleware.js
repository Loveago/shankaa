const jwt = require('jsonwebtoken');
require('dotenv').config();

module.exports = (req, res, next) => {
  try {
    // Only accept tokens from the Authorization header.
    // Query-string tokens are rejected because they:
    //   1) Leak in server access-logs, referrer headers, and browser history
    //   2) Can be bookmarked/shared inadvertently
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
