#!/usr/bin/env node

/**
 * CDN Build Script
 * Copies the UMD build to a standardized CDN-ready directory structure
 * and generates Subresource Integrity (SRI) hashes.
 *
 * Usage: node cdn-build.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SDK_VERSION = require('./package.json').version;
const MAJOR_VERSION = SDK_VERSION.split('.')[0];

const DIST_DIR = path.resolve(__dirname, 'dist');
const CDN_DIR = path.resolve(__dirname, 'cdn');

const UMD_SOURCE = path.join(DIST_DIR, 'clianta.umd.min.js');

function generateSRI(filePath) {
  const content = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha384').update(content).digest('base64');
  return `sha384-${hash}`;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function main() {
  console.log(`\n📦 Clianta SDK CDN Build v${SDK_VERSION}\n`);

  if (!fs.existsSync(UMD_SOURCE)) {
    console.error(`❌ UMD build not found at ${UMD_SOURCE}`);
    console.error('   Run "npm run build" first.');
    process.exit(1);
  }

  // cdn/sdk/v1/clianta.min.js       (latest v1)
  // cdn/sdk/v1.4.0/clianta.min.js   (pinned version)
  const versionedDir = path.join(CDN_DIR, 'sdk', `v${SDK_VERSION}`);
  const majorDir = path.join(CDN_DIR, 'sdk', `v${MAJOR_VERSION}`);

  ensureDir(versionedDir);
  ensureDir(majorDir);

  const versionedFile = path.join(versionedDir, 'clianta.min.js');
  fs.copyFileSync(UMD_SOURCE, versionedFile);
  console.log(`✅ Copied to ${path.relative(process.cwd(), versionedFile)}`);

  const majorFile = path.join(majorDir, 'clianta.min.js');
  fs.copyFileSync(UMD_SOURCE, majorFile);
  console.log(`✅ Copied to ${path.relative(process.cwd(), majorFile)}`);

  const sriHash = generateSRI(versionedFile);
  console.log(`\n🔒 SRI Hash: ${sriHash}`);

  const manifest = {
    version: SDK_VERSION,
    buildDate: new Date().toISOString(),
    files: {
      [`sdk/v${SDK_VERSION}/clianta.min.js`]: {
        size: fs.statSync(versionedFile).size,
        integrity: sriHash,
      },
      [`sdk/v${MAJOR_VERSION}/clianta.min.js`]: {
        size: fs.statSync(majorFile).size,
        integrity: sriHash,
      },
    },
  };

  const manifestPath = path.join(CDN_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`✅ Manifest written to ${path.relative(process.cwd(), manifestPath)}`);

  console.log('\n📋 Script Tag (with SRI):');
  console.log(`<script src="https://cdn.clianta.online/sdk/v${MAJOR_VERSION}/clianta.min.js" integrity="${sriHash}" crossorigin="anonymous"></script>`);

  console.log(`\n📋 Pinned Version:`);
  console.log(`<script src="https://cdn.clianta.online/sdk/v${SDK_VERSION}/clianta.min.js" integrity="${sriHash}" crossorigin="anonymous"></script>\n`);
}

main();
