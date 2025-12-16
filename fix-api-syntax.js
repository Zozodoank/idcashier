const fs = require('fs');
const path = require('path');

// Baca file api.js
const apiFilePath = path.join(__dirname, 'src', 'lib', 'api.js');
let content = fs.readFileSync(apiFilePath, 'utf8');

// Temukan dan perbaiki missing closing braces untuk attendanceMachinesAPI
const brokenPattern = /(\s+}) catch \(error\) \{\s+throw error;\s+\}\s+(\/\/ Store Settings API)/;
const fixedPattern = `$1  }
};

$2`;

content = content.replace(brokenPattern, fixedPattern);

// Tulis file yang sudah diperbaiki
fs.writeFileSync(apiFilePath, content, 'utf8');
console.log('✅ Fixed api.js syntax error - missing closing braces added');