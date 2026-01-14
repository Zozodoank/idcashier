const fs = require('fs');
const path = require('path');

// Directory containing Edge Functions
const functionsDir = path.join(__dirname, 'supabase', 'functions');

// Function to add @ts-ignore comments before Deno usage
function fixDenoErrors(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Pattern 1: Deno.serve without @ts-ignore
    if (content.includes('Deno.serve') && !content.includes('@ts-ignore: Deno is available in Supabase Edge Functions runtime')) {
        content = content.replace(
            /^(Deno\.serve\(async \(req)/gm,
            '// @ts-ignore: Deno is available in Supabase Edge Functions runtime\n$1'
        );
        modified = true;
    }

    // Pattern 2: Deno.env.get without @ts-ignore (but not already commented)
    const lines = content.split('\n');
    const newLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const prevLine = i > 0 ? lines[i - 1] : '';

        // Check if line contains Deno.env.get and previous line doesn't have @ts-ignore
        if (line.includes('Deno.env.get') && !prevLine.includes('@ts-ignore')) {
            // Add @ts-ignore comment before the line
            const indent = line.match(/^\s*/)[0];
            newLines.push(`${indent}// @ts-ignore: Deno is available at runtime`);
            newLines.push(line);
            modified = true;
        } else {
            newLines.push(line);
        }
    }

    if (modified) {
        fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
        console.log(`✅ Fixed: ${path.relative(functionsDir, filePath)}`);
        return true;
    }

    return false;
}

// Recursively find all index.ts files
function findIndexFiles(dir) {
    const files = [];
    const items = fs.readdirSync(dir);

    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && item !== 'node_modules' && item !== '_shared') {
            files.push(...findIndexFiles(fullPath));
        } else if (item === 'index.ts') {
            files.push(fullPath);
        }
    }

    return files;
}

// Main execution
console.log('🔍 Scanning for Edge Functions with Deno errors...\n');

const indexFiles = findIndexFiles(functionsDir);
let fixedCount = 0;

for (const file of indexFiles) {
    if (fixDenoErrors(file)) {
        fixedCount++;
    }
}

console.log(`\n✅ Fixed ${fixedCount} files out of ${indexFiles.length} total Edge Functions`);
