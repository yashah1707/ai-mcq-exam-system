const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) {
    res.status(401);
    return next(new Error('No token provided'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    next();
  } catch (err) {
    res.status(401);
    next(new Error('Invalid or expired token'));
  }
};

const authorizeRoles = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    res.status(401);
    return next(new Error('Not authenticated'));
  }
  if (!allowedRoles.includes(req.user.role)) {
    res.status(403);
    return next(new Error('Forbidden'));
  }
  next();
};

module.exports = { verifyToken, authorizeRoles };
