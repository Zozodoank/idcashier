const fs = require('fs');
const path = require('path');

// Baca file api.js
const apiFilePath = path.join(__dirname, 'src', 'lib', 'api.js');
let content = fs.readFileSync(apiFilePath, 'utf8');

// Cari dan perbaiki missing catch block - try without catch
const brokenPattern = /(\s+if \(error\) throw new Error\(error\.message \|\| 'Failed to delete attendance machine'\);\s+return true;\s+)(\s+}\s+)\s+(\s+}\s*;\s*)$/;
const fixedPattern = `$1    } catch (error) {
      throw error;
    }
$2
$3`;

content = content.replace(brokenPattern, fixedPattern);

// Tulis file yang sudah diperbaiki
fs.writeFileSync(apiFilePath, content, 'utf8');
console.log('✅ Fixed api.js try without catch');