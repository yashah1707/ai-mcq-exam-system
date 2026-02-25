const User = require('../models/user.model');
const { generateToken, sendVerificationEmail, sendPasswordResetEmail } = require('../services/email.service');

/**
 * Verify user email with token
 */
const verifyEmail = async (req, res, next) => {
    try {
        const { token } = req.query;

        if (!token) {
            res.status(400);
            throw new Error('Verification token is required');
        }

        const user = await User.findOne({ verificationToken: token });

        if (!user) {
            res.status(400);
            throw new Error('Invalid or expired verification token');
        }

        // Mark user as verified
        user.isVerified = true;
        user.verificationToken = null;
        await user.save();

        res.json({ message: 'Email verified successfully. You can now login.' });
    } catch (err) {
        next(err);
    }
};

/**
 * Resend verification email
 */
const resendVerificationEmail = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            res.status(400);
            throw new Error('Email is required');
        }

        const user = await User.findOne({ email });

        if (!user) {
            res.status(404);
            throw new Error('User not found');
        }

        if (user.isVerified) {
            res.status(400);
            throw new Error('Email is already verified');
        }

        // Generate new token
        const token = generateToken();
        user.verificationToken = token;
        await user.save();

        // Send verification email
        await sendVerificationEmail(user.email, token, user.name);

        res.json({ message: 'Verification email sent successfully' });
    } catch (err) {
        next(err);
    }
};

/**
 * Request password reset
 */
const requestPasswordReset = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            res.status(400);
            throw new Error('Email is required');
        }

        const user = await User.findOne({ email });

        if (!user) {
            // Don't reveal if user exists or not for security
            return res.json({ message: 'If the email exists, a password reset link has been sent' });
        }

        // Generate reset token
        const token = generateToken();
        user.resetPasswordToken = token;
        user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
        await user.save();

        // Send password reset email
        await sendPasswordResetEmail(user.email, token, user.name);

        res.json({ message: 'If the email exists, a password reset link has been sent' });
    } catch (err) {
        next(err);
    }
};

/**
 * Reset password with token
 */
const resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            res.status(400);
            throw new Error('Token and new password are required');
        }

        if (newPassword.length < 6) {
            res.status(400);
            throw new Error('Password must be at least 6 characters long');
        }

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            res.status(400);
            throw new Error('Invalid or expired reset token');
        }

        // Hash new password
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();

        res.json({ message: 'Password reset successfully. You can now login with your new password.' });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    verifyEmail,
    resendVerificationEmail,
    requestPasswordReset,
    resetPassword,
};
