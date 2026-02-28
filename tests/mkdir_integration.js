require('fs').mkdirSync('C:\\app\\morrisB\\sdk\\tests\\integration', { recursive: true });
const fs = require('fs');
const path = 'C:\\app\\morrisB\\sdk\\tests\\integration';
if (fs.existsSync(path)) {
  console.log('✓ Directory successfully created: ' + path);
  console.log('✓ Directory exists: ' + fs.existsSync(path));
} else {
  console.log('✗ Failed to create directory');
}
