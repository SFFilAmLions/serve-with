import fs from 'node:fs';
import { validateAdmins } from './validate-admins.mjs';
const admins = validateAdmins(fs.readFileSync('config/admins.yaml', 'utf8'));
fs.mkdirSync('src/generated', { recursive: true });
fs.writeFileSync('src/generated/admins.json', JSON.stringify(admins, null, 2) + '\n');
console.log(`Generated server allowlist (${admins.length} entries)`);
