/**
 * Authentication Middleware
 * JWT token validation and role-based access control
 */

const jwt = require('jsonwebtoken');

/**
 * Verify JWT token middleware
 */
function verifyToken(req, res, next) {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Access denied. No token provided.'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'blood-platform-secret');
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            error: 'Invalid token.'
        });
    }
}

/**
 * Check if user has required role
 */
function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required.'
            });
        }

        const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.role];
        const requiredRoles = Array.isArray(roles) ? roles : [roles];

        const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

        if (!hasRequiredRole) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions.'
            });
        }

        next();
    };
}

/**
 * Check if user has platform access
 */
function requirePlatformAccess(platform = 'blood-platform') {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required.'
            });
        }

        const platformAccess = req.user.platformAccess || [];
        
        if (!platformAccess.includes(platform) && !platformAccess.includes('all')) {
            return res.status(403).json({
                success: false,
                error: 'Platform access denied.'
            });
        }

        next();
    };
}

/**
 * Optional authentication - doesn't fail if no token
 */
function optionalAuth(req, res, next) {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'blood-platform-secret');
            req.user = decoded;
        } catch (error) {
            // Token is invalid but we don't fail the request
            req.user = null;
        }
    }

    next();
}

/**
 * Check if user can access donor data
 */
function canAccessDonorData(req, res, next) {
    const { donorId } = req.params;
    
    // Admin and hospital staff can access any donor data
    if (req.user.role === 'admin' || req.user.role === 'hospital_staff') {
        return next();
    }

    // Donors can only access their own data
    if (req.user.role === 'donor' && req.user.donorId === donorId) {
        return next();
    }

    return res.status(403).json({
        success: false,
        error: 'Cannot access this donor data.'
    });
}

/**
 * Check if user can access request data
 */
function canAccessRequestData(req, res, next) {
    const { requestId } = req.params;
    
    // Admin and hospital staff can access any request data
    if (req.user.role === 'admin' || req.user.role === 'hospital_staff') {
        return next();
    }

    // Recipients can only access their own requests
    if (req.user.role === 'recipient' && req.user.requestId === requestId) {
        return next();
    }

    return res.status(403).json({
        success: false,
        error: 'Cannot access this request data.'
    });
}

/**
 * Rate limiting for sensitive operations
 */
function rateLimitSensitive(maxRequests = 5, windowMs = 15 * 60 * 1000) {
    const requests = new Map();

    return (req, res, next) => {
        const key = req.user ? req.user.userId : req.ip;
        const now = Date.now();
        
        if (!requests.has(key)) {
            requests.set(key, []);
        }

        const userRequests = requests.get(key);
        
        // Remove old requests outside the window
        const validRequests = userRequests.filter(time => now - time < windowMs);
        
        if (validRequests.length >= maxRequests) {
            return res.status(429).json({
                success: false,
                error: 'Too many requests. Please try again later.'
            });
        }

        validRequests.push(now);
        requests.set(key, validRequests);
        
        next();
    };
}

/**
 * Log authentication events
 */
function logAuthEvent(req, res, next) {
    const event = {
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path,
        method: req.method,
        userId: req.user?.userId,
        role: req.user?.role
    };

    console.log('Auth Event:', JSON.stringify(event));
    next();
}

module.exports = {
    verifyToken,
    requireRole,
    requirePlatformAccess,
    optionalAuth,
    canAccessDonorData,
    canAccessRequestData,
    rateLimitSensitive,
    logAuthEvent
};