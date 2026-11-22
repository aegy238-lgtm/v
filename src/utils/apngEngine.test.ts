import assert from 'node:assert/strict';
import { parseApngBuffer } from './apngEngine';

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + 4 + data.length + 4);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length, false);
  for (let i = 0; i < 4; i++) {
    out[4 + i] = type.charCodeAt(i);
  }
  out.set(data, 8);
  // Trailing 4 bytes are CRC (not needed for chunk-timing parser)
  return out;
}

function concatBytes(chunks: Uint8Array[]): ArrayBuffer {
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const res = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    res.set(c, offset);
    offset += c.length;
  }
  return res.buffer;
}

function makeActl(numFrames: number, numPlays: number): Uint8Array {
  const data = new Uint8Array(8);
  const view = new DataView(data.buffer);
  view.setUint32(0, numFrames, false);
  view.setUint32(4, numPlays, false);
  return makeChunk('acTL', data);
}

function makeFctl(seq: number, delayNum: number, delayDen: number): Uint8Array {
  const data = new Uint8Array(26);
  const view = new DataView(data.buffer);
  view.setUint32(0, seq, false);
  view.setUint32(4, 100, false); // width
  view.setUint32(8, 100, false); // height
  view.setUint16(20, delayNum, false);
  view.setUint16(22, delayDen, false);
  return makeChunk('fcTL', data);
}

// 1. Valid APNG with 3 frames:
//    Frame 0: 100 / 100s = 1000ms (delayDen = 0 defaults to 100)
//    Frame 1: 50 / 25s = 2000ms
//    Frame 2: 0 / 100s -> 33ms minimal step
const apngSinglePlay = concatBytes([
  new Uint8Array(PNG_SIG),
  makeChunk('IHDR', new Uint8Array(13)),
  makeActl(3, 1),
  makeFctl(0, 100, 0),
  makeFctl(1, 50, 25),
  makeFctl(2, 0, 100),
  makeChunk('IEND', new Uint8Array(0)),
]);

const parsedSingle = parseApngBuffer(apngSinglePlay, 'image/apng');
assert.equal(parsedSingle.isApng, true);
assert.equal(parsedSingle.numFrames, 3);
assert.equal(parsedSingle.numPlays, 1);
assert.equal(parsedSingle.cycleDurationMs, 3033);
assert.equal(parsedSingle.totalDurationMs, 3033);

// 2. Finite multi-loop APNG (numPlays = 3 loops of 2500ms -> 7500ms)
const apngMultiLoop = concatBytes([
  new Uint8Array(PNG_SIG),
  makeChunk('IHDR', new Uint8Array(13)),
  makeActl(2, 3),
  makeFctl(0, 125, 100),
  makeFctl(1, 125, 100),
  makeChunk('IEND', new Uint8Array(0)),
]);
const parsedMulti = parseApngBuffer(apngMultiLoop);
assert.equal(parsedMulti.isApng, true);
assert.equal(parsedMulti.cycleDurationMs, 2500);
assert.equal(parsedMulti.totalDurationMs, 7500);

// 3. Infinite-loop APNG (numPlays = 0) plays 1 full cycle accurately
const apngInfinite = concatBytes([
  new Uint8Array(PNG_SIG),
  makeChunk('IHDR', new Uint8Array(13)),
  makeActl(2, 0),
  makeFctl(0, 400, 100),
  makeFctl(1, 350, 100),
  makeChunk('IEND', new Uint8Array(0)),
]);
const parsedInf = parseApngBuffer(apngInfinite);
assert.equal(parsedInf.isApng, true);
assert.equal(parsedInf.cycleDurationMs, 7500);
assert.equal(parsedInf.totalDurationMs, 7500);

// 4. Plain static PNG without acTL -> isApng === false
const staticPng = concatBytes([
  new Uint8Array(PNG_SIG),
  makeChunk('IHDR', new Uint8Array(13)),
  makeChunk('IDAT', new Uint8Array(16)),
  makeChunk('IEND', new Uint8Array(0)),
]);
const parsedStatic = parseApngBuffer(staticPng);
assert.equal(parsedStatic.isApng, false);
assert.equal(parsedStatic.totalDurationMs, 0);

// 5. Non-PNG random bytes -> isApng === false
const nonPng = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).buffer;
assert.equal(parseApngBuffer(nonPng).isApng, false);

console.log('All apngEngine tests passed!');
