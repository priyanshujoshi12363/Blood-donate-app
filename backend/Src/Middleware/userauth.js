import jwt from 'jsonwebtoken';
import { User } from '../Models/User.model.js';
export const verifyToken = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization || req.headers.Authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
        errorCode: 'NO_TOKEN'
      });
    }

    // Extract token
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token format.',
        errorCode: 'INVALID_TOKEN_FORMAT'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user and attach to request
    const user = await User.findById(decoded.userId)
      .select('-password -sessionId -__v')
      .lean();
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found or token is invalid.',
        errorCode: 'USER_NOT_FOUND'
      });
    }

    // Check if user is active/not blocked (optional)
    if (user.status && user.status === 'blocked') {
      return res.status(403).json({
        success: false,
        message: 'Account is blocked. Please contact support.',
        errorCode: 'ACCOUNT_BLOCKED'
      });
    }

    // Attach user to request object
    req.user = user;
    req.userId = user._id;
    
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    
    // Handle different JWT errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please login again.',
        errorCode: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.',
        errorCode: 'INVALID_TOKEN'
      });
    }
    
    // Handle other errors
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.',
      errorCode: 'AUTH_SERVER_ERROR'
    });
  }
};