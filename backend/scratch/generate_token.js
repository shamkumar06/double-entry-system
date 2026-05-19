const jwt = require('jsonwebtoken');

const secret = "super-secret-jwt-key-change-in-production-min-32-chars";
const user = {
  id: '7731d280-d445-4b36-b710-f6e3e3f7c1bb',
  email: 'sham8056071949@gmail.com',
  role: 'ADMIN'
};

const token = jwt.sign(
  { id: user.id, email: user.email, role: user.role },
  secret,
  { expiresIn: '7d' }
);

console.log('--- GENERATED LOCAL JWT TOKEN ---');
console.log(token);
