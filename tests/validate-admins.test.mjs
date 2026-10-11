import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAdmins } from '../scripts/validate-admins.mjs';

test('empty allowlist denies all admins by default', () => {
  assert.deepEqual(validateAdmins('admins: []'), []);
});
test('valid admins are normalized and disabled entries preserved', () => {
  assert.deepEqual(validateAdmins('admins:\n  - email: ADMIN@Example.org\n    enabled: true\n  - email: off@example.org\n    enabled: false'), [
    { email: 'admin@example.org', enabled: true },
    { email: 'off@example.org', enabled: false },
  ]);
});
test('duplicates, malformed and unknown fields rejected', () => {
  const cases = [
    'admins:\n  - email: x@example.org\n    enabled: true\n  - email: X@example.org\n    enabled: false',
    'admins:\n  - email: not-an-email\n    enabled: true',
    'admins:\n  - email: x@example.org\n    enabled: yes',
    'admins: []\nunexpected: true',
    'admins:\n  - email: x@example.org\n    enabled: true\n    role: superuser',
    'admins: []\nadmins: []',
  ];
  for (const yaml of cases) assert.throws(() => validateAdmins(yaml));
});
