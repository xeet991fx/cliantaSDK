#!/usr/bin/env node

/**
 * Bootstrap script: Creates sdk/scripts/cdn-build.js
 * Run once with: node _bootstrap-cdn-build.js
 * Then delete this file.
 */

const fs = require('fs');
const path = require('path');

const scriptsDir = path.join(__dirname, 'scripts');
const targetFile = path.join(scriptsDir, 'cdn-build.js');

fs.mkdirSync(scriptsDir, { recursive: true });

const content = `#!/usr/bin/env node

/**
 * CDN Build Script
 * Copies the UMD build to a standardized CDN-ready directory structure
 * and generates Subresource Integrity (SRI) hashes.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SDK_VERSION = require('../package.json').version;
const MAJOR_VERSION = SDK_VERSION.split('.')[0];

const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const CDN_DIR = path.resolve(__dirname, '..', 'cdn');

const UMD_SOURCE = path.join(DIST_DIR, 'clianta-sdk.umd.js');

function generateSRI(filePath) {
  const content = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha384').update(content).digest('base64');
  return \`sha384-\${hash}\`;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyWithMinifiedName(src, destDir, baseName) {
  const dest = path.join(destDir, baseName);
  fs.copyFileSync(src, dest);
  return dest;
}

function main() {
  console.log(\`\\n📦 Clianta SDK CDN Build v\${SDK_VERSION}\\n\`);

  if (!fs.existsSync(UMD_SOURCE)) {
    console.error(\`❌ UMD build not found at \${UMD_SOURCE}\`);
    console.error('   Run "npm run build" first.');
    process.exit(1);
  }

  // Create CDN directory structure:
  //   cdn/sdk/v1/clianta.min.js       (latest v1)
  //   cdn/sdk/v1.4.0/clianta.min.js   (pinned version)
  const versionedDir = path.join(CDN_DIR, 'sdk', \`v\${SDK_VERSION}\`);
  const majorDir = path.join(CDN_DIR, 'sdk', \`v\${MAJOR_VERSION}\`);

  ensureDir(versionedDir);
  ensureDir(majorDir);

  // Copy to versioned directory
  const versionedFile = copyWithMinifiedName(UMD_SOURCE, versionedDir, 'clianta.min.js');
  console.log(\`✅ Copied to \${path.relative(process.cwd(), versionedFile)}\`);

  // Copy to major version directory (latest)
  const majorFile = copyWithMinifiedName(UMD_SOURCE, majorDir, 'clianta.min.js');
  console.log(\`✅ Copied to \${path.relative(process.cwd(), majorFile)}\`);

  // Generate SRI hashes
  const sriHash = generateSRI(versionedFile);
  console.log(\`\\n🔒 SRI Hash: \${sriHash}\`);

  // Write manifest
  const manifest = {
    version: SDK_VERSION,
    buildDate: new Date().toISOString(),
    files: {
      [\`sdk/v\${SDK_VERSION}/clianta.min.js\`]: {
        size: fs.statSync(versionedFile).size,
        integrity: sriHash,
      },
      [\`sdk/v\${MAJOR_VERSION}/clianta.min.js\`]: {
        size: fs.statSync(majorFile).size,
        integrity: sriHash,
      },
    },
  };

  const manifestPath = path.join(CDN_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(\`✅ Manifest written to \${path.relative(process.cwd(), manifestPath)}\`);

  // Print usage snippet
  console.log('\\n📋 Script Tag (with SRI):');
  console.log(\`<script src="https://cdn.clianta.online/sdk/v\${MAJOR_VERSION}/clianta.min.js" integrity="\${sriHash}" crossorigin="anonymous"></script>\`);

  console.log(\`\\n📋 Pinned Version:\`);
  console.log(\`<script src="https://cdn.clianta.online/sdk/v\${SDK_VERSION}/clianta.min.js" integrity="\${sriHash}" crossorigin="anonymous"></script>\\n\`);
}

main();
`;

fs.writeFileSync(targetFile, content);
console.log(`✅ Created ${targetFile}`);
console.log('You can now delete this bootstrap file.');
