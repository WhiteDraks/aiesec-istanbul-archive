const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  // Get git commit count
  const commitCount = parseInt(execSync('git rev-list --count HEAD').toString().trim(), 10);
  
  // Define version format (Major.Minor.Patch) where Patch is git commit count
  // Since we are currently at version 1.2.X, let's establish 1.2.X as the base version format.
  const version = `1.2.${commitCount}`;

  // Read package.json
  const pkgPath = path.join(__dirname, '../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  
  pkg.version = version;
  
  // Write back to package.json
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Successfully updated package.json version to: ${version}`);
} catch (err) {
  console.error('Failed to update version:', err);
  process.exit(1);
}
