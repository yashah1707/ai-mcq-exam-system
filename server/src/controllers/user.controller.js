const User = require('../models/user.model');

const getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password');
    res.json({ users });
  } catch (err) {
    next(err);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['student', 'admin'].includes(role)) {
      res.status(400);
      throw new Error('Invalid role');
    }
    const user = await User.findByIdAndUpdate(id, { role }, { new: true }).select('-password');
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

const toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }
    user.isActive = !user.isActive;
    await user.save();
    res.json({ user: { id: user._id, isActive: user.isActive } });
  } catch (err) {
    next(err);
  }
};

module.exports = { getUsers, updateUserRole, toggleUserStatus };
