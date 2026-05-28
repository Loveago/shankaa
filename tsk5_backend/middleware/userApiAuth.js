const prisma = require('../config/db');

/**
 * Middleware: Authenticate via User API Key (x-api-key header).
 *
 * Looks up the key in the UserApiKey table, verifies it's active,
 * validates the linked user is not suspended, and attaches the
 * resolved user object to req.user for downstream controllers.
 */
const userApiAuth = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'Missing API key. Include x-api-key header.'
      });
    }

    const keyRecord = await prisma.userApiKey.findUnique({
      where: { apiKey },
      include: { user: true }
    });

    if (!keyRecord) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key.'
      });
    }

    if (!keyRecord.isActive) {
      return res.status(403).json({
        success: false,
        message: 'API key has been revoked. Please generate a new one from your dashboard.'
      });
    }

    if (keyRecord.user.isSuspended) {
      return res.status(403).json({
        success: false,
        message: 'Your account is suspended. Please contact support.'
      });
    }

    // Update last-used timestamp (fire-and-forget)
    prisma.userApiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsedAt: new Date() }
    }).catch(() => {});

    // Attach user + key info to the request
    req.user = {
      id: keyRecord.user.id,
      name: keyRecord.user.name,
      email: keyRecord.user.email,
      role: keyRecord.user.role,
      loanBalance: keyRecord.user.loanBalance,
      isSuspended: keyRecord.user.isSuspended
    };
    req.apiKeyRecord = {
      id: keyRecord.id,
      name: keyRecord.name
    };

    next();
  } catch (error) {
    console.error('User API auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed.'
    });
  }
};

module.exports = userApiAuth;
