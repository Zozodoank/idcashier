#!/usr/bin/env node

/**
 * SIMPLE PRODUCTION BUILD SCRIPT
 * Windows-compatible version
 */

import { execSync } from 'node:child_process';
import { existsSync, rmSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

console.log('🚀 Starting simple production build...\n');

const DIST_DIR = join(__dirname, 'dist');

// Step 1: Clean previous builds
console.log('🧹 Cleaning previous builds...');
if (existsSync(DIST_DIR)) {
  rmSync(DIST_DIR, { recursive: true, force: true });
}
mkdirSync(DIST_DIR, { recursive: true });

// Step 2: Set production environment
console.log('⚙️ Setting production environment...');
process.env.NODE_ENV = 'production';

// Step 3: Run Vite build (raw build script to avoid recursion)
console.log('🔨 Running Vite build...');
try {
  execSync('npm run build:raw', {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });
  console.log('✅ Vite build completed successfully');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

// Step 4: Create minimal package.json
console.log('📦 Creating production package.json...');
const productionPackageJson = {
  name: 'idcashier-webapp',
  version: '1.0.0',
  type: 'module',
  private: true,
  scripts: {
    start: 'serve -s dist -l 3000'
  }
};

writeFileSync(
  join(DIST_DIR, 'package.json'),
  JSON.stringify(productionPackageJson, null, 2)
);

// Step 5: Create deployment info
console.log('📋 Creating deployment info...');
const deploymentInfo = {
  buildDate: new Date().toISOString(),
  nodeVersion: process.version,
  platform: process.platform,
  optimization: {
    filesIncluded: [
      'index.html',
      'assets/ (Optimized bundles)',
      'src/ (Application source)',
      'public/ (Static assets)'
    ],
    filesExcluded: [
      'Development files (.js, .test.js, debug-*.js)',
      'Documentation (*.md files)',
      'Backend files (supabase/, migrations/)',
      'Development tools (tools/, testsprite_tests/)',
      'Configuration files (.stylelintrc.json, etc.)'
    ]
  }
};

writeFileSync(
  join(DIST_DIR, 'DEPLOYMENT_INFO.json'),
  JSON.stringify(deploymentInfo, null, 2)
);

// Step 6: Generate build report
console.log('📊 Build Summary...');
try {
  const fs = require('fs');
  
  function getDirSize(dirPath) {
    let totalSize = 0;
    const files = readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = join(dirPath, file);
      const stats = statSync(filePath);
      
      if (stats.isDirectory()) {
        totalSize += getDirSize(filePath);
      } else {
        totalSize += stats.size;
      }
    }
    
    return totalSize;
  }
  
  const distSize = getDirSize(DIST_DIR);
  const sizeInMB = (distSize / (1024 * 1024)).toFixed(2);
  const fileCount = readdirSync(DIST_DIR, { recursive: true }).length;
  
  console.log('\n✅ BUILD COMPLETED SUCCESSFULLY!');
  console.log('====================================');
  console.log(`📁 Output directory: ${DIST_DIR}`);
  console.log(`📊 Total size: ${sizeInMB} MB`);
  console.log(`📄 Total files: ${fileCount}`);
  console.log('📋 Deployment info: DEPLOYMENT_INFO.json');
  console.log('\n🚀 Ready for deployment!');
  console.log('   Run: npm run preview (to test locally)');
  console.log('   Or deploy the dist/ folder to your hosting service');
  
} catch (error) {
  console.log('\n✅ Build completed (size calculation failed)');
}

console.log('\n🎉 Simple production build complete!');