const express = require('express');
const {
  assignLabBatch,
  assignStudentsToClass,
  bulkAssignStudentsToClass,
  bulkCreateClasses,
  createClass,
  createLabBatch,
  deleteClass,
  deleteLabBatch,
  getClasses,
  promoteClasses,
  removeStudentsFromClass,
  updateClass,
  updateLabBatch,
} = require('../controllers/class.controller');
const { authorizeRoles, verifyToken } = require('../middleware/auth');
const { bulkAssignStudentsToClassValidation, bulkCreateClassesValidation } = require('../middleware/validators/class.validator');

const router = express.Router();

router.use(verifyToken, authorizeRoles('admin'));
router.get('/', getClasses);
router.post('/', createClass);
router.post('/bulk', bulkCreateClassesValidation, bulkCreateClasses);
router.post('/promote', promoteClasses);
router.put('/:id', updateClass);
router.delete('/:id', deleteClass);
router.post('/:id/assign-students', assignStudentsToClass);
router.post('/:id/bulk-assign-students', bulkAssignStudentsToClassValidation, bulkAssignStudentsToClass);
router.post('/:id/remove-students', removeStudentsFromClass);
router.post('/:id/lab-batches', createLabBatch);
router.put('/:id/lab-batches/:labBatchId', updateLabBatch);
router.delete('/:id/lab-batches/:labBatchId', deleteLabBatch);
router.post('/:id/assign-lab-batch', assignLabBatch);

module.exports = router;