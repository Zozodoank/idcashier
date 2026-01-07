const fs = require('fs');
const path = require('path');

const OLD_DOMAIN = 'idcashier.my.id';
const NEW_DOMAIN = 'idcashier.com';

// Directories to skip
const SKIP_DIRS = ['node_modules', '.git', '.vscode', 'dist', 'build', '.gemini'];
// Skip this script itself
const SKIP_FILES = ['package-lock.json', 'pnpm-lock.yaml', 'migrate-domain-final.js', 'migrate-domain-final.cjs'];

// Files to explicitly include even if they might be skipped/hidden
// Note: windows paths might differ but fs.existSync should handle relative paths from root
const INCLUDE_FILES = ['.env', '.env.example', '.vscode/sftp.json'];

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function (file) {
        const fullPath = path.join(dirPath, file);
        let stat;
        try {
            stat = fs.statSync(fullPath);
        } catch (e) {
            return; // Skip if invalid
        }

        if (stat.isDirectory()) {
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

// Add specific files if they exist and weren't found
INCLUDE_FILES.forEach(f => {
    const p = path.join(rootDir, f);
    // Remove if already in list to avoid duplicates
    filesToScan = filesToScan.filter(existing => existing !== p);

    if (fs.existsSync(p)) {
        filesToScan.push(p);
    }
});

let changedFiles = 0;

filesToScan.forEach(file => {
    try {
        const content = fs.readFileSync(file, 'utf8');

        if (content.includes(OLD_DOMAIN)) {
            // Use regex with global flag to replace all occurrences
            const regex = new RegExp(OLD_DOMAIN.replace(/\./g, '\\.'), 'g');
            const newContent = content.replace(regex, NEW_DOMAIN);

            fs.writeFileSync(file, newContent, 'utf8');
            console.log(`[UPDATED] ${file}`);
            changedFiles++;
        }
    } catch (err) {
        // Ignore errors
    }
});

console.log(`\nMigration complete. Updated ${changedFiles} files.`);
