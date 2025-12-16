const fs = require('fs');
const path = require('path');

// Baca file api.js
const apiFilePath = path.join(__dirname, 'src', 'lib', 'api.js');
let content = fs.readFileSync(apiFilePath, 'utf8');

// Fix double braces
content = content.replace(/}  }/g, `
  }
}`);

// Tulis file yang sudah diperbaiki
fs.writeFileSync(apiFilePath, content, 'utf8');
console.log('✅ Fixed api.js double braces issue');