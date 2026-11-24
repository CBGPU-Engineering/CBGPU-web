import assert from 'node:assert/strict';
import path from 'node:path';
import sharp from 'sharp';

const [baseline, candidate] = process.argv.slice(2);
if (!baseline || !candidate) throw Error('Pass baseline and candidate screenshot directories.');

const screens = [
  'home-390.png',
  'home-1440.png',
  'services-390.png',
  'schools-1440.png',
  'contest-390.png',
  'project-1440.png',
  'login-390.png',
  'school-guide-390.png',
  'quick-search-1440.png',
  'timetable-authenticated-1440.png',
];

for (const file of screens) {
  const [expected, current] = await Promise.all([baseline, candidate].map(directory =>
    sharp(path.join(directory, file)).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true }),
  ));
  assert.deepEqual(current.info, expected.info, file + ' geometry changed');
  let changed = 0;
  // Compare RGB channels with enough tolerance for minor browser font raster differences.
  for (let pixel = 0; pixel < current.data.length; pixel += 3) {
    if ([0, 1, 2].some(channel => Math.abs(current.data[pixel + channel] - expected.data[pixel + channel]) > 20)) changed++;
  }
  const ratio = changed / (current.info.width * current.info.height);
  assert.ok(ratio <= .003, file + ' changed on ' + (ratio * 100).toFixed(2) + '% of pixels');
  console.log(file + '  ' + (ratio * 100).toFixed(2) + '%');
}
