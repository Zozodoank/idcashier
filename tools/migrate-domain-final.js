const fs = require('fs');
const path = require('path');

const OLD_DOMAIN = 'idcashier.com';
const NEW_DOMAIN = 'idcashier.com';

// Directories to skip
const SKIP_DIRS = ['node_modules', '.git', '.vscode', 'dist', 'build', '.gemini'];
const SKIP_FILES = ['package-lock.json', 'pnpm-lock.yaml', 'migrate-domain-final.js'];

// Files to explicitly include even if they might be skipped/hidden
const INCLUDE_FILES = ['.env', '.env.example', 'sftp.json', '.vscode/sftp.json'];

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    const fullPath = path.join(dirPath, file);
    
    if (fs.statSync(fullPath).isDirectory()) {
        if (!SKIP_DIRS.includes(file)) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        }
    } else {
        if (!SKIP_FILES.includes(file)) {
            arrayOfFiles.push(fullPath);
        }
    }
  });

  return arrayOfFiles;
}

const rootDir = process.cwd();
console.log(`Scanning directory: ${rootDir}`);
console.log(`Replacing '${OLD_DOMAIN}' with '${NEW_DOMAIN}'...`);

let filesToScan = getAllFiles(rootDir);

// Add specific files if they exist and weren't found (e.g. .env might be hidden or skipped)
INCLUDE_FILES.forEach(f => {
    const p = path.join(rootDir, f);
    if (fs.existsSync(p) && !filesToScan.includes(p)) {
        filesToScan.push(p);
    }
});

let changedFiles = 0;

filesToScan.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    
    // Simple string replace
    if (content.includes(OLD_DOMAIN)) {
        // Use regex with global flag to replace all occurrences
        const regex = new RegExp(OLD_DOMAIN.replace(/\./g, '\\.'), 'g');
        const newContent = content.replace(regex, NEW_DOMAIN);
        
        fs.writeFileSync(file, newContent, 'utf8');
        console.log(`[UPDATED] ${file}`);
        changedFiles++;
    }
  } catch (err) {
    if (err.code !== 'EISDIR') { // Ignore directory read errors if any
        console.error(`Error processing ${file}: ${err.message}`);
    }
  }
});

console.log(`\nMigration complete. Updated ${changedFiles} files.`);
