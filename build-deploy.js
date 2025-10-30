import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join, basename } from 'path';

// Function to copy files recursively
function copyFileSync(source, target) {
    let targetFile = target;
    
    // If target is a directory, a new file with the same name will be created
    if (existsSync(target)) {
        if (lstatSync(target).isDirectory()) {
            targetFile = join(target, basename(source));
        }
    }
    
    writeFileSync(targetFile, readFileSync(source));
}

function copyFolderRecursiveSync(source, target) {
    let files = [];
    
    // Check if folder needs to be created or integrated
    const targetFolder = join(target, basename(source));
    if (!existsSync(targetFolder)) {
        mkdirSync(targetFolder);
    }
    
    // Copy
    if (lstatSync(source).isDirectory()) {
        files = readdirSync(source);
        files.forEach(function (file) {
            const curSource = join(source, file);
            if (lstatSync(curSource).isDirectory()) {
                copyFolderRecursiveSync(curSource, targetFolder);
            } else {
                // Skip .md files
                if (!file.endsWith('.md')) {
                    copyFileSync(curSource, targetFolder);
                }
            }
        });
    }
}

// Clean up existing deployment directory if it exists
const deployDir = join(process.cwd(), 'deployment');
if (existsSync(deployDir)) {
    rmSync(deployDir, { recursive: true, force: true });
}

// Create deployment directory
mkdirSync(deployDir);

console.log('Created deployment directory');

// Files and directories to include (excluding .md files)
const filesToInclude = [
    'package.json',
    'vite.config.js',
    '.env.example',
    '.gitignore',
    'index.html',
    'postcss.config.js',
    'tailwind.config.js',
    'src',
    'public',
    'plugins'
];

// Copy files
filesToInclude.forEach(file => {
    const sourcePath = join(process.cwd(), file);
    if (existsSync(sourcePath)) {
        if (lstatSync(sourcePath).isDirectory()) {
            copyFolderRecursiveSync(sourcePath, deployDir);
        } else {
            // Skip .md files
            if (!file.endsWith('.md')) {
                copyFileSync(sourcePath, deployDir);
            }
        }
    }
});

// Copy root-level .bat, .js, .sql, .cjs files (excluding .md)
const rootFiles = readdirSync(process.cwd());
rootFiles.forEach(file => {
    const filePath = join(process.cwd(), file);
    if (lstatSync(filePath).isFile()) {
        // Skip .md files and other unnecessary files
        if (!file.endsWith('.md') && !file.endsWith('.zip') && !file.endsWith('.gz') && !file.endsWith('.mjs')) {
            // Include .bat, .js, .sql, .cjs files and some specific files
            if (file.endsWith('.bat') || file.endsWith('.js') || file.endsWith('.sql') || file.endsWith('.cjs') || 
                file === 'sftp.json' || file === 'sync-config.json' || file === '.nvmrc' || file === '.version' ||
                file === '.stylelintrc.json') {
                copyFileSync(filePath, deployDir);
            }
        }
    }
});

console.log('Deployment files copied to:', deployDir);
console.log('Now changing to deployment directory and pushing to GitHub...');

// Now let's initialize git in the deployment directory and push to GitHub
import { execSync } from 'child_process';

try {
    // Change to deployment directory
    process.chdir(deployDir);
    
    // Initialize git repo
    execSync('git init', { stdio: 'inherit' });
    
    // Add all files
    execSync('git add .', { stdio: 'inherit' });
    
    // Configure git user (if not already configured)
    try {
        execSync('git config --global user.email "user@example.com"', { stdio: 'inherit' });
        execSync('git config --global user.name "Project Mandiri"', { stdio: 'inherit' });
    } catch (e) {
        console.log('Git user already configured');
    }
    
    // Commit files
    execSync('git commit -m "Initial commit: Deployment files for idcashier build"', { stdio: 'inherit' });
    
    // Add remote origin
    execSync('git remote add origin https://github.com/projectmandiri10-lang/idcashier.git', { stdio: 'inherit' });
    
    // Push to GitHub using master branch (force push to overwrite any existing content)
    execSync('git push -u origin master --force', { stdio: 'inherit' });
    
    console.log('Successfully pushed deployment files to GitHub');
} catch (error) {
    console.error('Error during git operations:', error.message);
}