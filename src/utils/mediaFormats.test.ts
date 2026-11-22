import assert from 'node:assert/strict';
import {
  clampEffectDurationSec,
  detectMediaKind,
  getMediaFormatLabel,
  resolveEntranceStageMedia,
  resolveGiftStageMedia,
} from './mediaFormats';

// Format detection across extensions, query hints, data URIs, and extensionless CDN links
assert.equal(detectMediaKind('https://cdn.example.com/lion.mp4?token=abc'), 'video');
assert.equal(detectMediaKind('https://cdn.example.com/lion.webm'), 'video');
assert.equal(detectMediaKind('https://cdn.example.com/sparkle.gif?v=2'), 'animated_image');
assert.equal(detectMediaKind('https://cdn.example.com/crown.webp'), 'animated_image');
assert.equal(detectMediaKind('https://cdn.example.com/dragon.apng?v=1'), 'animated_image');
assert.equal(detectMediaKind('data:image/apng;base64,AAAA'), 'animated_image');
assert.equal(detectMediaKind('https://cdn.example.com/frame.png'), 'image');
assert.equal(detectMediaKind('https://cdn.example.com/media?id=123&format=mp4'), 'video');
assert.equal(detectMediaKind('https://cdn.example.com/asset/abc123'), 'unknown');
assert.equal(detectMediaKind('data:video/mp4;base64,AAAA'), 'video');
assert.equal(detectMediaKind('data:image/gif;base64,R0lGOD'), 'animated_image');

assert.equal(getMediaFormatLabel('https://cdn.example.com/lion.mp4'), 'MP4');
assert.equal(getMediaFormatLabel('https://cdn.example.com/sparkle.gif'), 'GIF');
assert.equal(getMediaFormatLabel('https://cdn.example.com/dragon.apng'), 'APNG');
assert.equal(getMediaFormatLabel('https://cdn.example.com/audio/hit.mp3?v=1'), 'MP3');

// Duration clamping
assert.equal(clampEffectDurationSec(undefined, 5), 5);
assert.equal(clampEffectDurationSec(0, 7), 7);
assert.equal(clampEffectDurationSec(18, 7), 18);
assert.equal(clampEffectDurationSec(999, 7), 120);

// Entrance resolution: MP4/WebM vs GIF/WebP/APNG/PNG
const vidEntrance = resolveEntranceStageMedia({
  videoUrl: 'https://cdn.example.com/car.mp4',
  previewUrl: 'https://cdn.example.com/car.png',
});
assert.equal(vidEntrance.isVideoEntrance, true);
assert.equal(vidEntrance.preferVideo, true);
assert.equal(vidEntrance.hasExplicitDuration, false);

const gifEntrance = resolveEntranceStageMedia({
  videoUrl: 'https://cdn.example.com/car.gif',
  effectDurationSec: 12,
});
assert.equal(gifEntrance.isVideoEntrance, false);
assert.equal(gifEntrance.preferVideo, false);
assert.equal(gifEntrance.durationMs, 12000);
assert.equal(gifEntrance.hasExplicitDuration, true);

// Gift resolution: APNG / GIF / WebP / PNG / MP4 all trigger full-room stage media
const apngAutoGift = resolveGiftStageMedia({
  imageUrl: 'https://cdn.example.com/dragon.apng',
});
assert.equal(apngAutoGift.mediaUrl, 'https://cdn.example.com/dragon.apng');
assert.equal(apngAutoGift.preferVideo, false);
assert.equal(apngAutoGift.hasExplicitDuration, false);

const gifGift = resolveGiftStageMedia({
  imageUrl: 'https://cdn.example.com/dragon.webp',
  effectDurationSec: 6,
});
assert.equal(gifGift.mediaUrl, 'https://cdn.example.com/dragon.webp');
assert.equal(gifGift.preferVideo, false);
assert.equal(gifGift.durationMs, 6000);
assert.equal(gifGift.hasExplicitDuration, true);

const mp4Gift = resolveGiftStageMedia({
  videoUrl: 'https://cdn.example.com/dragon.mp4',
  imageUrl: 'https://cdn.example.com/dragon.png',
});
assert.equal(mp4Gift.mediaUrl, 'https://cdn.example.com/dragon.mp4');
assert.equal(mp4Gift.fallbackUrl, 'https://cdn.example.com/dragon.png');
assert.equal(mp4Gift.preferVideo, true);
assert.equal(mp4Gift.hasExplicitDuration, false);

console.log('All mediaFormats tests passed!');
