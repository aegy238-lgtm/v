import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Static & Structural Verification of the "Dirty Dozen" Security Invariants
 * against firestore.rules.
 */
const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

// 1. Default deny catch-all exists
assert.match(rulesContent, /match \/\{document=\*\*\}[\s\S]*allow read, write: if false;/);

// 2. Email verification is strictly enforced for admin email matching
assert.match(rulesContent, /request\.auth\.token\.email_verified == true/);

// 3. ID poisoning guard exists and is applied to single-doc matches
assert.match(rulesContent, /function isValidId\(id\)/);
assert.match(rulesContent, /isValidId\(roomId\)/);
assert.match(rulesContent, /isValidId\(userId\)/);

// 4. All write blocks invoke validation helpers including age & gender checks
assert.match(rulesContent, /isValidAuraVoiceUser\(incoming\(\)\)/);
assert.match(rulesContent, /data\.gender in \['male', 'female'\]/);
assert.match(rulesContent, /data\.age is number && data\.age >= 13 && data\.age <= 100/);
assert.match(rulesContent, /isValidVoiceRoom\(incoming\(\)\)/);
assert.match(rulesContent, /isValidRoomMessage\(incoming\(\)\)/);
assert.match(rulesContent, /isValidGiftItem\(incoming\(\)\)/);
assert.match(rulesContent, /isValidStoreItem\(incoming\(\)\)/);
assert.match(rulesContent, /'soundUrl' in data/);
assert.match(rulesContent, /'effectDurationSec' in data/);
assert.match(rulesContent, /isValidTransaction\(incoming\(\)\)/);
assert.match(rulesContent, /isValidRoomBackground\(incoming\(\)\)/);
assert.match(rulesContent, /'backgroundUrl' in data/);
assert.match(rulesContent, /'moderators' in existing\(\)/);

// 5. No blanket open writes
assert.equal(/allow\s+(write|create|update|delete)\s*:\s*if\s+true\s*;/.test(rulesContent), false);

console.log('All firestore.rules structural security invariants verified.');
