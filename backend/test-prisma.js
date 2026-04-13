const { execSync } = require('child_process');
try {
  execSync('npx prisma generate', { encoding: 'utf8' });
} catch (e) {
  console.log("----- ERROR STDOUT -----");
  console.log(e.stdout);
  console.log("----- ERROR STDERR -----");
  console.log(e.stderr);
}
