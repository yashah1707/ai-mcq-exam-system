const fs = require('fs');
const file = 'c:\\Users\\shour\\ai-mcq-exam-system\\client\\src\\pages\\AdminClasses.jsx';
let text = fs.readFileSync(file, 'utf8');

text = text.replace(/â€¦/g, '…')
           .replace(/ðŸ ›ï¸ /g, '🏛️')
           .replace(/â€”/g, '—')
           .replace(/Â·/g, '·')
           .replace(/Ã—/g, '×');

fs.writeFileSync(file, text, 'utf8');
console.log('Fixed file');
