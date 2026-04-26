const { body, validationResult } = require('express-validator');

const req = {
  body: {
    passingMarks: 10,
    totalMarks: 2
  }
};

const run = async () => {
  const chain = body('passingMarks').custom((value, { req }) => {
      console.log('value:', typeof value, value);
      console.log('req.body.totalMarks:', typeof req.body.totalMarks, req.body.totalMarks);
      if (value > req.body.totalMarks) {
          throw new Error('Passing marks cannot exceed total marks');
      }
      return true;
  });
  await chain.run(req);
  const errors = validationResult(req);
  console.log(errors.array());
};
run();
