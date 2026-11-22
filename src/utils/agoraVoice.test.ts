import assert from 'node:assert/strict';
import {
  agoraVoice,
  formatAgoraChannelName,
  getAgoraAppId,
  sanitizeAgoraUid,
} from './agoraVoice';

const appId = getAgoraAppId();
assert.equal(appId, '467d6372146f4670b6c37a0364fb5fdd', 'Agora App ID must match 467d6372146f4670b6c37a0364fb5fdd');
assert.match(appId, /^[a-f0-9]{32}$/, 'Agora App ID must be a 32-char hex string');

const channel = formatAgoraChannelName('room_101:vip/arabic');
assert.equal(channel, 'auravoice_room_101_vip_arabic');
assert.ok(channel.length <= 64, 'Agora channel name must be <= 64 chars');

assert.equal(sanitizeAgoraUid('user_1'), 'user_1');
assert.equal(sanitizeAgoraUid('user@arabic 123'), 'user_arabic_123');
assert.equal(sanitizeAgoraUid('   '), 'guest_user');

// Verify subscription/mute APIs are callable without throwing
let statusSeen: boolean | null = null;
const unsubMic = agoraVoice.subscribeMicStatus((status) => {
  statusSeen = status;
});
assert.equal(statusSeen, false);
unsubMic();

agoraVoice.setRemoteAudioMuted(true);
agoraVoice.setRemoteAudioMuted(false);

console.log('All agoraVoice tests passed!');
