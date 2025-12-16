#!/usr/bin/env node

/**
 * PRODUCTION BUILD OPTIMIZATION SCRIPT
 * 
 * This script creates an optimized production build that only includes
 * files necessary for running the application.
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

console.log('🚀 Starting optimized production build...\n');

// Configuration
const DIST_DIR = join(__dirname, 'dist');
const TEMP_BUILD_DIR = join(__dirname, '.temp-build');

// Step 1: Clean previous builds
console.log('🧹 Cleaning previous builds...');
if (existsSync(DIST_DIR)) {
  rmSync(DIST_DIR, { recursive: true, force: true });
}
if (existsSync(TEMP_BUILD_DIR)) {
  rmSync(TEMP_BUILD_DIR, { recursive: true, force: true });
}
mkdirSync(DIST_DIR, { recursive: true });

// Step 2: Set production environment
console.log('⚙️ Setting production environment...');
process.env.NODE_ENV = 'production';
process.env.VITE_APP_ENV = 'production';

// Step 3: Run optimized Vite build (using raw build script to avoid recursion)
console.log('🔨 Running optimized Vite build...');
try {
  execSync('npm run build:raw', {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production'
    }
  });
  console.log('✅ Vite build completed successfully');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

// Step 4: Post-build optimization
console.log('✨ Post-build optimization...');

// Copy only essential files to dist
const essentialFiles = [
  'index.html',
  'src'
];

const nonEssentialFiles = [
  // Remove development files
  '.gitignore',
  '.gitignore-production',
  'README.md',
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  
  // Remove development scripts and tools
  '*.js',
  '*.test.js',
  '*.spec.js',
  'test-*.js',
  'debug-*.js',
  'comprehensive-*.js',
  'create-*.js',
  'investigate-*.js',
  'load-*.js',
  'reset-*.js',
  'verify-*.js',
  'fix-*.js',
  'direct-*.js',
  'alternative-*.js',
  'apply-*.js',
  'cleanup-*.js',
  'check-*.js',
  'run-*.js',
  'deploy-*.js',
  'build-*.js',
  'push-*.js',
  'sync-*.js',
  'products-cleanup-*.js',
  'real-*.js',
  
  // Remove documentation
  '*.md',
  'docs/',
  'migrations/',
  'supabase/',
  'tools/',
  'testsprite_tests/',
  
  // Remove development directories
  '.continue/',
  '.kiro/',
  '.roo/',
  '.github/',
  
  // Remove configuration files (keep only essential ones)
  '.stylelintrc.json',
  'postcss.config.js',
  'tailwind.config.js',
  'deno.json',
  
  // Remove debug and test files from public
  'public/debug-*.html',
  'public/diagnostic.html',
  'public/test-*.html',
  'public/llms.txt',
  
  // Remove PHP library (backend only)
  'duitku_library/',
  
  // Remove plugin directories (development only)
  'plugins/'
];

// Step 5: Clean dist directory of non-essential files
console.log('🧽 Cleaning dist directory...');
const distContents = existsSync(DIST_DIR) ? 
  execSync(`find ${DIST_DIR} -type f`, { encoding: 'utf-8' }).split('\n').filter(f => f.trim()) : 
  [];

// Remove non-essential files
for (const file of distContents) {
  if (file.trim()) {
    const shouldRemove = nonEssentialFiles.some(pattern => {
      if (pattern.endsWith('/')) {
        return file.includes(pattern);
      }
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(file);
      }
      return file.endsWith(pattern);
    });
    
    if (shouldRemove) {
      try {
        rmSync(file, { force: true });
      } catch (error) {
        // Ignore permission errors
      }
    }
  }
}

// Step 6: Create minimal package.json for production
console.log('📦 Creating production package.json...');
const productionPackageJson = {
  name: 'idcashier-webapp',
  version: '1.0.0',
  type: 'module',
  private: true,
  scripts: {
    start: 'serve -s dist -l 3000'
  },
  dependencies: {},
  devDependencies: {}
};

import { writeFileSync } from 'node:fs';
writeFileSync(
  join(DIST_DIR, 'package.json'), 
  JSON.stringify(productionPackageJson, null, 2)
);

// Step 7: Create deployment info
console.log('📋 Creating deployment info...');
const deploymentInfo = {
  buildDate: new Date().toISOString(),
  nodeVersion: process.version,
  platform: process.platform,
  arch: process.arch,
  filesIncluded: [
    'index.html',
    'assets/ (JavaScript bundles)',
    'src/ (Application source)',
    'public/ (Static assets)',
    'package.json (Production)'
  ],
  filesExcluded: [
    'Development files (.js, .test.js, debug-*.js)',
    'Documentation (*.md files)',
    'Backend files (supabase/, migrations/)',
    'Development tools (tools/, testsprite_tests/)',
    'Configuration files (.stylelintrc.json, etc.)',
    'Plugin directories (plugins/)',
    'PHP library (duitku_library/)'
  ]
};

writeFileSync(
  join(DIST_DIR, 'DEPLOYMENT_INFO.json'),
  JSON.stringify(deploymentInfo, null, 2)
);

// Step 8: Generate build report
console.log('📊 Generating build report...');
try {
  const distSize = execSync(`du -sh ${DIST_DIR}`, { encoding: 'utf-8' }).trim();
  const fileCount = execSync(`find ${DIST_DIR} -type f | wc -l`, { encoding: 'utf-8' }).trim();
  
  console.log('\n✅ BUILD COMPLETED SUCCESSFULLY!');
  console.log('====================================');
  console.log(`📁 Output directory: ${DIST_DIR}`);
  console.log(`📊 Total size: ${distSize}`);
  console.log(`📄 Total files: ${fileCount}`);
  console.log('📋 Deployment info: DEPLOYMENT_INFO.json');
  console.log('\n🚀 Ready for deployment!');
  console.log('   Run: npm run preview (to test locally)');
  console.log('   Or deploy the dist/ folder to your hosting service');
  
} catch (error) {
  console.log('\n✅ Build completed (size calculation failed)');
}

// Cleanup
if (existsSync(TEMP_BUILD_DIR)) {
  rmSync(TEMP_BUILD_DIR, { recursive: true, force: true });
}

console.log('\n🎉 Production build optimization complete!');