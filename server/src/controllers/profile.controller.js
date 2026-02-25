const User = require('../models/user.model');
const bcrypt = require('bcryptjs');

/**
 * Get current user profile
 */
const getProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (!user) {
            res.status(404);
            throw new Error('User not found');
        }
        res.json({ user });
    } catch (err) {
        next(err);
    }
};

/**
 * Update user profile (name, email)
 */
const updateProfile = async (req, res, next) => {
    try {
        const { firstName, lastName, email } = req.body;

        const user = await User.findById(req.user._id);
        if (!user) {
            res.status(404);
            throw new Error('User not found');
        }

        // Check if email is being changed and if it's already taken
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                res.status(409);
                throw new Error('Email already in use');
            }
            user.email = email;
            // If email changes, require re-verification
            user.isVerified = false;
        }

        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;

        await user.save();

        const updatedUser = await User.findById(user._id).select('-password');
        res.json({
            user: updatedUser,
            message: email && email !== req.user.email
                ? 'Profile updated. Please verify your new email address.'
                : 'Profile updated successfully'
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Change password
 */
const changePassword = async (req, res, next) => {
    try {
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            res.status(400);
            throw new Error('Old password and new password are required');
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            res.status(404);
            throw new Error('User not found');
        }

        // Verify old password
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            res.status(401);
            throw new Error('Current password is incorrect');
        }

        // Check if new password is too similar to old password
        const similarity = calculateSimilarity(oldPassword, newPassword);
        if (similarity >= 0.7) {
            res.status(400);
            throw new Error('New password is too similar to your current password. Please choose a more different password.');
        }

        // Hash and save new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ message: 'Password changed successfully' });
    } catch (err) {
        next(err);
    }
};

// Helper function to calculate similarity between two strings using Levenshtein distance
const calculateSimilarity = (str1, str2) => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
};

// Levenshtein distance algorithm
const levenshteinDistance = (str1, str2) => {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[str2.length][str1.length];
};

module.exports = {
    getProfile,
    updateProfile,
    changePassword
};
