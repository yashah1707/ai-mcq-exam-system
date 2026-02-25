const fs = require('fs');
const pdf = require('pdf-parse');

const file = './docx/SRS.pdf';

let dataBuffer = fs.readFileSync(file);

pdf(dataBuffer).then(function(data) {
    console.log(data.text);
}).catch(err => {
    console.error('Error reading PDF:', err);
    process.exit(1);
});
