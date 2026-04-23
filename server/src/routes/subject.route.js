const express = require('express');
const {
  createSubject,
  deleteSubject,
  getStudentSubjectScope,
  listSubjects,
  updateSubject,
} = require('../controllers/subject.controller');
const { authorizeRoles, verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);
router.get('/', listSubjects);
router.get('/student-scope', getStudentSubjectScope);
router.post('/', authorizeRoles('admin'), createSubject);
router.put('/:id', authorizeRoles('admin'), updateSubject);
router.delete('/:id', authorizeRoles('admin'), deleteSubject);

module.exports = router;