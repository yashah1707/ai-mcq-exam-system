const AcademicClass = require('../models/academicClass.model');
const User = require('../models/user.model');
const { serializeUser } = require('../utils/userIdentity');
const { DEFAULT_COURSE, YEAR_OPTIONS, normalizeCourseValue } = require('../utils/subjects');

const normalizeName = (value) => String(value || '').trim();
const normalizeEnrollmentNo = (value) => String(value || '').trim().toUpperCase();
const normalizeStudentIds = (studentIds) => Array.from(new Set(
  (Array.isArray(studentIds) ? studentIds : [])
    .map((studentId) => String(studentId || '').trim())
    .filter(Boolean)
));

const normalizeCapacity = (value) => Number(value || 0);
const normalizeYear = (value, fallback = 1) => {
  const numericYear = Number(value);
  if (Number.isInteger(numericYear) && YEAR_OPTIONS.includes(numericYear)) {
    return numericYear;
  }

  return fallback;
};

const createClassDocument = async (payload) => {
  const name = normalizeName(payload.name).toUpperCase();
  const year = normalizeYear(payload.year, 1);
  const course = normalizeCourseValue(payload.course);
  const capacity = normalizeCapacity(payload.capacity ?? 60);
  const description = normalizeName(payload.description);

  if (!name) {
    throw new Error('Class name is required');
  }

  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new Error('Class capacity must be a positive integer');
  }

  if (!YEAR_OPTIONS.includes(year)) {
    throw new Error('Class year must be between 1 and 4');
  }

  const existingClass = await AcademicClass.findOne({ name });
  if (existingClass) {
    throw new Error('A class with this name already exists');
  }

  return AcademicClass.create({
    name,
    year,
    course,
    capacity,
    description,
    labBatches: [],
  });
};

const getSerializedStudents = async () => {
  const students = await User.find({ role: 'student' }).select('-password').sort({ firstName: 1, lastName: 1, name: 1 });
  return students.map(serializeUser);
};

const getLabBatchByName = (academicClass, labBatchName) => {
  const normalizedLabBatchName = normalizeName(labBatchName).toLowerCase();
  if (!normalizedLabBatchName) {
    return null;
  }

  return (Array.isArray(academicClass.labBatches) ? academicClass.labBatches : []).find(
    (entry) => normalizeName(entry.name).toLowerCase() === normalizedLabBatchName
  ) || null;
};

const getClassRoster = async (className) => {
  return User.find({ role: 'student', batch: className }).select('_id batch labBatch enrollmentNo');
};

const buildLabBatchCounts = (academicClass, roster) => {
  const counts = new Map();

  (Array.isArray(academicClass.labBatches) ? academicClass.labBatches : []).forEach((labBatch) => {
    counts.set(labBatch.name, 0);
  });

  roster.forEach((student) => {
    if (student.labBatch && counts.has(student.labBatch)) {
      counts.set(student.labBatch, (counts.get(student.labBatch) || 0) + 1);
    }
  });

  return counts;
};

const propagateClassRenameToTeachers = async (oldName, newName) => {
  if (!oldName || !newName || oldName === newName) {
    return;
  }

  await Promise.all([
    User.updateMany(
      { role: 'teacher', assignedBatches: oldName },
      { $set: { 'assignedBatches.$[entry]': newName } },
      { arrayFilters: [{ entry: oldName }] }
    ),
    User.updateMany(
      { role: 'teacher', 'assignedLabBatches.className': oldName },
      { $set: { 'assignedLabBatches.$[entry].className': newName } },
      { arrayFilters: [{ 'entry.className': oldName }] }
    ),
  ]);
};

const serializeClass = (academicClass, students = []) => {
  const source = typeof academicClass.toObject === 'function' ? academicClass.toObject() : academicClass;
  const classStudents = students.filter((student) => student.batch === source.name);

  return {
    _id: source._id,
    name: source.name,
    year: normalizeYear(source.year, 1),
    course: normalizeCourseValue(source.course || DEFAULT_COURSE),
    capacity: source.capacity,
    description: source.description || '',
    createdAt: source.createdAt,
    studentCount: classStudents.length,
    labBatches: (Array.isArray(source.labBatches) ? source.labBatches : []).map((labBatch) => ({
      _id: labBatch._id,
      name: labBatch.name,
      capacity: labBatch.capacity,
      studentCount: classStudents.filter((student) => student.labBatch === labBatch.name).length,
    })),
  };
};

const getClasses = async (req, res, next) => {
  try {
    const [classes, students] = await Promise.all([
      AcademicClass.find().sort({ name: 1 }),
      User.find({ role: 'student' }).select('-password').sort({ firstName: 1, lastName: 1, name: 1 }),
    ]);

    const serializedStudents = students.map(serializeUser);
    res.json({
      classes: classes.map((academicClass) => serializeClass(academicClass, serializedStudents)),
      students: serializedStudents,
    });
  } catch (err) {
    next(err);
  }
};

const createClass = async (req, res, next) => {
  try {
    const academicClass = await createClassDocument(req.body);
    res.status(201).json({ class: serializeClass(academicClass), message: 'Class created successfully.' });
  } catch (err) {
    if (err.message === 'A class with this name already exists') {
      res.status(409);
    } else {
      res.status(res.statusCode >= 400 ? res.statusCode : 400);
    }
    next(err);
  }
};

const bulkCreateClasses = async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body) ? req.body : [];

    if (rows.length === 0) {
      res.status(400);
      throw new Error('Payload must be a non-empty array of classes');
    }

    const seenNames = new Set();
    const createdClasses = [];
    const errors = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {};
      const rowNumber = index + 2;
      const normalizedName = normalizeName(row.name).toUpperCase();

      if (!normalizedName) {
        errors.push({ row: rowNumber, name: '', message: 'Class name is required' });
        continue;
      }

      if (seenNames.has(normalizedName)) {
        errors.push({ row: rowNumber, name: normalizedName, message: 'Duplicate class name in import file' });
        continue;
      }

      seenNames.add(normalizedName);

      try {
        const academicClass = await createClassDocument({
          ...row,
          name: normalizedName,
        });

        createdClasses.push({
          row: rowNumber,
          class: serializeClass(academicClass),
        });
      } catch (error) {
        errors.push({
          row: rowNumber,
          name: normalizedName,
          message: error.message,
        });
      }
    }

    const [classes, students] = await Promise.all([
      AcademicClass.find().sort({ name: 1 }),
      User.find({ role: 'student' }).select('-password').sort({ firstName: 1, lastName: 1, name: 1 }),
    ]);
    const serializedStudents = students.map(serializeUser);

    res.status(createdClasses.length > 0 ? 201 : 400).json({
      createdCount: createdClasses.length,
      failedCount: errors.length,
      createdClasses,
      errors,
      classes: classes.map((academicClass) => serializeClass(academicClass, serializedStudents)),
      students: serializedStudents,
      message: `Bulk import finished. Created ${createdClasses.length} class(es) and failed ${errors.length}.`,
    });
  } catch (err) {
    next(err);
  }
};

const updateClass = async (req, res, next) => {
  try {
    const { id } = req.params;
    const academicClass = await AcademicClass.findById(id);
    if (!academicClass) {
      res.status(404);
      throw new Error('Class not found');
    }

    const nextName = normalizeName(req.body.name || academicClass.name).toUpperCase();
    const nextYear = normalizeYear(req.body.year ?? academicClass.year, normalizeYear(academicClass.year, 1));
    const nextCourse = normalizeCourseValue(req.body.course ?? academicClass.course ?? DEFAULT_COURSE);
    const nextCapacity = normalizeCapacity(req.body.capacity ?? academicClass.capacity);
    const nextDescription = normalizeName(req.body.description ?? academicClass.description);

    if (!nextName) {
      res.status(400);
      throw new Error('Class name is required');
    }

    if (!Number.isInteger(nextCapacity) || nextCapacity <= 0) {
      res.status(400);
      throw new Error('Class capacity must be a positive integer');
    }

    if (!YEAR_OPTIONS.includes(nextYear)) {
      res.status(400);
      throw new Error('Class year must be between 1 and 4');
    }

    const duplicateClass = await AcademicClass.findOne({ name: nextName, _id: { $ne: academicClass._id } });
    if (duplicateClass) {
      res.status(409);
      throw new Error('A class with this name already exists');
    }

    const currentStudentCount = await User.countDocuments({ role: 'student', batch: academicClass.name });
    if (nextCapacity > 0 && currentStudentCount > nextCapacity) {
      res.status(400);
      throw new Error(`Class capacity cannot be lower than the current student count of ${currentStudentCount}`);
    }

    const previousName = academicClass.name;
    academicClass.name = nextName;
    academicClass.year = nextYear;
    academicClass.course = nextCourse;
    academicClass.capacity = nextCapacity;
    academicClass.description = nextDescription;
    await academicClass.save();

    if (previousName !== nextName) {
      await Promise.all([
        User.updateMany({ role: 'student', batch: previousName }, { $set: { batch: nextName } }),
        propagateClassRenameToTeachers(previousName, nextName),
      ]);
    }

    const serializedStudents = await getSerializedStudents();
    res.json({
      class: serializeClass(academicClass, serializedStudents),
      students: serializedStudents,
      message: 'Class updated successfully.',
    });
  } catch (err) {
    next(err);
  }
};

const deleteClass = async (req, res, next) => {
  try {
    const { id } = req.params;
    const academicClass = await AcademicClass.findById(id);
    if (!academicClass) {
      res.status(404);
      throw new Error('Class not found');
    }

    const className = academicClass.name;

    await Promise.all([
      User.updateMany({ role: 'student', batch: className }, { $set: { batch: '', labBatch: '' } }),
      User.updateMany({ role: 'teacher' }, { $pull: { assignedBatches: className, assignedLabBatches: { className } } }),
      AcademicClass.findByIdAndDelete(id),
    ]);

    res.json({ message: 'Class deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

const promoteClasses = async (req, res, next) => {
  try {
    const classIds = Array.from(new Set(
      (Array.isArray(req.body.classIds) ? req.body.classIds : [])
        .map((classId) => String(classId || '').trim())
        .filter(Boolean)
    ));

    if (classIds.length === 0) {
      res.status(400);
      throw new Error('Select at least one class to promote');
    }

    const classes = await AcademicClass.find({ _id: { $in: classIds } });
    if (classes.length !== classIds.length) {
      res.status(404);
      throw new Error('One or more selected classes do not exist');
    }

    const finalYearClasses = classes.filter((academicClass) => normalizeYear(academicClass.year, 1) >= 4);
    if (finalYearClasses.length > 0) {
      res.status(400);
      throw new Error(`Cannot promote final-year classes: ${finalYearClasses.map((academicClass) => academicClass.name).join(', ')}`);
    }

    await Promise.all(classes.map((academicClass) => {
      academicClass.year = normalizeYear(academicClass.year, 1) + 1;
      return academicClass.save();
    }));

    const [refreshedClasses, students] = await Promise.all([
      AcademicClass.find().sort({ name: 1 }),
      User.find({ role: 'student' }).select('-password').sort({ firstName: 1, lastName: 1, name: 1 }),
    ]);
    const serializedStudents = students.map(serializeUser);

    res.json({
      classes: refreshedClasses.map((academicClass) => serializeClass(academicClass, serializedStudents)),
      students: serializedStudents,
      promotedCount: classes.length,
      message: `Promoted ${classes.length} class(es) to the next year successfully.`,
    });
  } catch (err) {
    next(err);
  }
};

const assignStudentsToClass = async (req, res, next) => {
  try {
    const { id } = req.params;
    const studentIds = normalizeStudentIds(req.body.studentIds);

    if (studentIds.length === 0) {
      res.status(400);
      throw new Error('Select at least one student to assign to the class');
    }

    const academicClass = await AcademicClass.findById(id);
    if (!academicClass) {
      res.status(404);
      throw new Error('Class not found');
    }

    const students = await User.find({ _id: { $in: studentIds }, role: 'student' });
    if (students.length !== studentIds.length) {
      res.status(400);
      throw new Error('One or more selected students do not exist');
    }

    const currentClassStudentCount = await User.countDocuments({ role: 'student', batch: academicClass.name });
    const alreadyInClassCount = students.filter((student) => student.batch === academicClass.name).length;
    const finalClassCount = currentClassStudentCount + (students.length - alreadyInClassCount);

    if (academicClass.capacity > 0 && finalClassCount > academicClass.capacity) {
      res.status(400);
      throw new Error(`This assignment exceeds the class capacity of ${academicClass.capacity}`);
    }

    await User.updateMany(
      { _id: { $in: studentIds }, role: 'student' },
      { $set: { batch: academicClass.name, labBatch: '' } },
    );

    const refreshedStudents = await User.find({ role: 'student' }).select('-password').sort({ firstName: 1, lastName: 1, name: 1 });
    res.json({
      class: serializeClass(academicClass, refreshedStudents.map(serializeUser)),
      students: refreshedStudents.map(serializeUser),
      message: 'Students assigned to class successfully.',
    });
  } catch (err) {
    next(err);
  }
};

const bulkAssignStudentsToClass = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rows = Array.isArray(req.body) ? req.body : [];

    if (rows.length === 0) {
      res.status(400);
      throw new Error('Payload must be a non-empty array of student assignments');
    }

    const academicClass = await AcademicClass.findById(id);
    if (!academicClass) {
      res.status(404);
      throw new Error('Class not found');
    }

    const requestedEnrollments = Array.from(new Set(
      rows
        .map((row) => normalizeEnrollmentNo(row?.enrollmentNo))
        .filter(Boolean)
    ));

    const [matchedStudents, classRoster] = await Promise.all([
      User.find({ role: 'student', enrollmentNo: { $in: requestedEnrollments } }),
      getClassRoster(academicClass.name),
    ]);

    const studentByEnrollment = new Map(
      matchedStudents.map((student) => [normalizeEnrollmentNo(student.enrollmentNo), student])
    );
    const projectedLabBatchCounts = buildLabBatchCounts(academicClass, classRoster);
    let projectedClassCount = classRoster.length;

    const seenEnrollments = new Set();
    const assignedStudents = [];
    const errors = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {};
      const rowNumber = index + 2;
      const enrollmentNo = normalizeEnrollmentNo(row.enrollmentNo);
      const requestedLabBatchName = normalizeName(row.labBatch);

      if (!enrollmentNo) {
        errors.push({ row: rowNumber, enrollmentNo: '', message: 'Enrollment number is required' });
        continue;
      }

      if (seenEnrollments.has(enrollmentNo)) {
        errors.push({ row: rowNumber, enrollmentNo, message: 'Duplicate enrollment number in import file' });
        continue;
      }

      seenEnrollments.add(enrollmentNo);

      const student = studentByEnrollment.get(enrollmentNo);
      if (!student) {
        errors.push({ row: rowNumber, enrollmentNo, message: 'Student not found' });
        continue;
      }

      const labBatch = requestedLabBatchName ? getLabBatchByName(academicClass, requestedLabBatchName) : null;
      if (requestedLabBatchName && !labBatch) {
        errors.push({ row: rowNumber, enrollmentNo, message: 'Lab batch not found in this class' });
        continue;
      }

      const currentlyInTargetClass = student.batch === academicClass.name;
      if (!currentlyInTargetClass && academicClass.capacity > 0 && projectedClassCount + 1 > academicClass.capacity) {
        errors.push({ row: rowNumber, enrollmentNo, message: `This assignment exceeds the class capacity of ${academicClass.capacity}` });
        continue;
      }

      const currentLabBatchName = currentlyInTargetClass ? normalizeName(student.labBatch) : '';
      const targetLabBatchName = labBatch ? labBatch.name : '';

      if (labBatch) {
        const currentTargetCount = projectedLabBatchCounts.get(labBatch.name) || 0;
        const alreadyInTargetLabBatch = currentlyInTargetClass && currentLabBatchName === labBatch.name;
        const projectedTargetCount = currentTargetCount + (alreadyInTargetLabBatch ? 0 : 1);

        if (labBatch.capacity > 0 && projectedTargetCount > labBatch.capacity) {
          errors.push({ row: rowNumber, enrollmentNo, message: `This assignment exceeds the lab batch capacity of ${labBatch.capacity}` });
          continue;
        }
      }

      if (!currentlyInTargetClass) {
        projectedClassCount += 1;
      }

      if (currentlyInTargetClass && currentLabBatchName && projectedLabBatchCounts.has(currentLabBatchName) && currentLabBatchName !== targetLabBatchName) {
        projectedLabBatchCounts.set(currentLabBatchName, Math.max((projectedLabBatchCounts.get(currentLabBatchName) || 0) - 1, 0));
      }

      if (labBatch && currentLabBatchName !== labBatch.name) {
        projectedLabBatchCounts.set(labBatch.name, (projectedLabBatchCounts.get(labBatch.name) || 0) + 1);
      }

      student.batch = academicClass.name;
      student.labBatch = targetLabBatchName;
      await student.save();

      assignedStudents.push({
        row: rowNumber,
        enrollmentNo,
        student: serializeUser(student),
      });
    }

    const serializedStudents = await getSerializedStudents();
    res.status(assignedStudents.length > 0 ? 200 : 400).json({
      class: serializeClass(academicClass, serializedStudents),
      students: serializedStudents,
      assignedCount: assignedStudents.length,
      failedCount: errors.length,
      assignedStudents,
      errors,
      message: `Bulk student assignment finished. Assigned ${assignedStudents.length} student(s) and failed ${errors.length}.`,
    });
  } catch (err) {
    next(err);
  }
};

const removeStudentsFromClass = async (req, res, next) => {
  try {
    const { id } = req.params;
    const studentIds = normalizeStudentIds(req.body.studentIds);

    if (studentIds.length === 0) {
      res.status(400);
      throw new Error('Select at least one student to remove from the class');
    }

    const academicClass = await AcademicClass.findById(id);
    if (!academicClass) {
      res.status(404);
      throw new Error('Class not found');
    }

    const students = await User.find({ _id: { $in: studentIds }, role: 'student' });
    if (students.length !== studentIds.length) {
      res.status(400);
      throw new Error('One or more selected students do not exist');
    }

    const invalidStudent = students.find((student) => student.batch !== academicClass.name);
    if (invalidStudent) {
      res.status(400);
      throw new Error('Students must belong to the selected class before they can be removed');
    }

    await User.updateMany(
      { _id: { $in: studentIds }, role: 'student', batch: academicClass.name },
      { $set: { batch: '', labBatch: '' } },
    );

    const serializedStudents = await getSerializedStudents();
    res.json({
      class: serializeClass(academicClass, serializedStudents),
      students: serializedStudents,
      message: 'Students removed from class successfully.',
    });
  } catch (err) {
    next(err);
  }
};

const createLabBatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const name = normalizeName(req.body.name);
    const capacity = normalizeCapacity(req.body.capacity);

    if (!name) {
      res.status(400);
      throw new Error('Lab batch name is required');
    }

    if (!Number.isInteger(capacity) || capacity <= 0) {
      res.status(400);
      throw new Error('Lab batch capacity must be a positive integer');
    }

    const academicClass = await AcademicClass.findById(id);
    if (!academicClass) {
      res.status(404);
      throw new Error('Class not found');
    }

    if (academicClass.labBatches.some((labBatch) => labBatch.name.toLowerCase() === name.toLowerCase())) {
      res.status(409);
      throw new Error('A lab batch with this name already exists in the class');
    }

    academicClass.labBatches.push({ name, capacity });
    await academicClass.save();

    const students = await User.find({ role: 'student' }).select('-password').sort({ firstName: 1, lastName: 1, name: 1 });
    res.status(201).json({
      class: serializeClass(academicClass, students.map(serializeUser)),
      students: students.map(serializeUser),
      message: 'Lab batch created successfully.',
    });
  } catch (err) {
    next(err);
  }
};

const updateLabBatch = async (req, res, next) => {
  try {
    const { id, labBatchId } = req.params;
    const academicClass = await AcademicClass.findById(id);
    if (!academicClass) {
      res.status(404);
      throw new Error('Class not found');
    }

    const labBatch = academicClass.labBatches.id(labBatchId);
    if (!labBatch) {
      res.status(404);
      throw new Error('Lab batch not found');
    }

    const nextName = normalizeName(req.body.name || labBatch.name);
    const nextCapacity = normalizeCapacity(req.body.capacity ?? labBatch.capacity);

    if (!nextName) {
      res.status(400);
      throw new Error('Lab batch name is required');
    }

    if (!Number.isInteger(nextCapacity) || nextCapacity <= 0) {
      res.status(400);
      throw new Error('Lab batch capacity must be a positive integer');
    }

    const duplicateBatch = academicClass.labBatches.find((entry) => (
      String(entry._id) !== String(labBatchId) && entry.name.toLowerCase() === nextName.toLowerCase()
    ));
    if (duplicateBatch) {
      res.status(409);
      throw new Error('A lab batch with this name already exists in the class');
    }

    const currentStudentCount = await User.countDocuments({ role: 'student', batch: academicClass.name, labBatch: labBatch.name });
    if (nextCapacity > 0 && currentStudentCount > nextCapacity) {
      res.status(400);
      throw new Error(`Lab batch capacity cannot be lower than the current student count of ${currentStudentCount}`);
    }

    const previousName = labBatch.name;
    labBatch.name = nextName;
    labBatch.capacity = nextCapacity;
    await academicClass.save();

    if (previousName !== nextName) {
      await Promise.all([
        User.updateMany(
          { role: 'student', batch: academicClass.name, labBatch: previousName },
          { $set: { labBatch: nextName } },
        ),
        User.updateMany(
          { role: 'teacher', assignedLabBatches: { $elemMatch: { className: academicClass.name, labBatchName: previousName } } },
          { $set: { 'assignedLabBatches.$[entry].labBatchName': nextName } },
          { arrayFilters: [{ 'entry.className': academicClass.name, 'entry.labBatchName': previousName }] }
        ),
      ]);
    }

    const serializedStudents = await getSerializedStudents();
    res.json({
      class: serializeClass(academicClass, serializedStudents),
      students: serializedStudents,
      message: 'Lab batch updated successfully.',
    });
  } catch (err) {
    next(err);
  }
};

const deleteLabBatch = async (req, res, next) => {
  try {
    const { id, labBatchId } = req.params;
    const academicClass = await AcademicClass.findById(id);
    if (!academicClass) {
      res.status(404);
      throw new Error('Class not found');
    }

    const labBatch = academicClass.labBatches.id(labBatchId);
    if (!labBatch) {
      res.status(404);
      throw new Error('Lab batch not found');
    }

    const labBatchName = labBatch.name;
    labBatch.deleteOne();
    await Promise.all([
      academicClass.save(),
      User.updateMany(
        { role: 'student', batch: academicClass.name, labBatch: labBatchName },
        { $set: { labBatch: '' } },
      ),
      User.updateMany(
        { role: 'teacher' },
        { $pull: { assignedLabBatches: { className: academicClass.name, labBatchName } } }
      ),
    ]);

    const serializedStudents = await getSerializedStudents();
    res.json({
      class: serializeClass(academicClass, serializedStudents),
      students: serializedStudents,
      message: 'Lab batch deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
};

const assignLabBatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const studentIds = normalizeStudentIds(req.body.studentIds);
    const labBatchName = normalizeName(req.body.labBatchName);

    if (studentIds.length === 0) {
      res.status(400);
      throw new Error('Select at least one student to update lab batch assignments');
    }

    const academicClass = await AcademicClass.findById(id);
    if (!academicClass) {
      res.status(404);
      throw new Error('Class not found');
    }

    const students = await User.find({ _id: { $in: studentIds }, role: 'student' });
    if (students.length !== studentIds.length) {
      res.status(400);
      throw new Error('One or more selected students do not exist');
    }

    const invalidStudent = students.find((student) => student.batch !== academicClass.name);
    if (invalidStudent) {
      res.status(400);
      throw new Error('Students must belong to the selected class before assigning a lab batch');
    }

    if (!labBatchName) {
      await User.updateMany({ _id: { $in: studentIds }, role: 'student' }, { $set: { labBatch: '' } });
      const refreshedStudents = await User.find({ role: 'student' }).select('-password').sort({ firstName: 1, lastName: 1, name: 1 });
      return res.json({
        class: serializeClass(academicClass, refreshedStudents.map(serializeUser)),
        students: refreshedStudents.map(serializeUser),
        message: 'Selected students were removed from their lab batch.',
      });
    }

    const labBatch = getLabBatchByName(academicClass, labBatchName);
    if (!labBatch) {
      res.status(404);
      throw new Error('Lab batch not found in this class');
    }

    const currentLabBatchMembers = await User.find({ role: 'student', batch: academicClass.name, labBatch: labBatch.name }).select('_id');
    const alreadyInLabBatchCount = students.filter((student) => student.labBatch === labBatch.name).length;
    const finalLabBatchCount = currentLabBatchMembers.length + (students.length - alreadyInLabBatchCount);

    if (labBatch.capacity > 0 && finalLabBatchCount > labBatch.capacity) {
      res.status(400);
      throw new Error(`This assignment exceeds the lab batch capacity of ${labBatch.capacity}`);
    }

    await User.updateMany({ _id: { $in: studentIds }, role: 'student' }, { $set: { labBatch: labBatch.name } });
    const refreshedStudents = await User.find({ role: 'student' }).select('-password').sort({ firstName: 1, lastName: 1, name: 1 });

    res.json({
      class: serializeClass(academicClass, refreshedStudents.map(serializeUser)),
      students: refreshedStudents.map(serializeUser),
      message: 'Lab batch assignments updated successfully.',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
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
};