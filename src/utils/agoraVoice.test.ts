import assert from 'node:assert/strict';
import {
  agoraVoice,
  DEFAULT_AGORA_APP_ID,
  formatAgoraChannelName,
  getAgoraAppId,
  isValidAgoraAppId,
  parseAgoraTokenInfo,
  sanitizeAgoraUid,
} from './agoraVoice';

async function run() {
  assert.equal(DEFAULT_AGORA_APP_ID, 'd5c272d82b094c2f86ccc75df0819dfe');
  const appId = getAgoraAppId();
  assert.equal(
    appId,
    'd5c272d82b094c2f86ccc75df0819dfe',
    'Agora App ID must match d5c272d82b094c2f86ccc75df0819dfe'
  );
  assert.ok(isValidAgoraAppId(appId), 'Agora App ID must be a 32-char hex string');

  assert.equal(formatAgoraChannelName('room_tyy'), 'auravoice_room_tyy');
  const channel = formatAgoraChannelName('room_101:vip/arabic');
  assert.equal(channel, 'auravoice_room_101_vip_arabic');
  assert.ok(channel.length <= 64, 'Agora channel name must be <= 64 chars');

  assert.equal(sanitizeAgoraUid('user_1'), 'user_1');
  assert.equal(sanitizeAgoraUid('user@arabic 123'), 'user_arabic_123');
  assert.equal(sanitizeAgoraUid('   '), 'guest_user');

  const userProvidedToken =
    '007eJxTYIicPmvOIZeUH6qVr10FdkZcjHBQiBLZXvnzYMDNgNRX4dcUGFJMk43MjVIsjJIMLE2SjdIszJKTk81NU9IMLAwtU9JS1wQyZTcEMjKcuWHKwMjACsRMDCA+AwMAxvoeqw==';
  const parsed = await parseAgoraTokenInfo(userProvidedToken);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.appId, 'd5c272d82b094c2f86ccc75df0819dfe');
  assert.equal(parsed.serviceType, 5);
  assert.equal(parsed.isRtcToken, false);

  let statusSeen: boolean | null = null;
  const unsubMic = agoraVoice.subscribeMicStatus((status) => {
    statusSeen = status;
  });
  assert.equal(statusSeen, false);
  unsubMic();

  let connState: string | null = null;
  let connProvider: string | undefined;
  let requiresToken: boolean | undefined;
  const unsubStatus = agoraVoice.subscribeStatus((st) => {
    connState = st.state;
    connProvider = st.provider;
    requiresToken = st.requiresToken;
  });
  assert.equal(connState, 'idle');
  assert.equal(connProvider, 'self_hosted');
  assert.equal(requiresToken, false);
  unsubStatus();

  agoraVoice.setRemoteAudioMuted(true);
  agoraVoice.setRemoteAudioMuted(false);

  console.log('All agoraVoice tests passed!');
}

void run();
