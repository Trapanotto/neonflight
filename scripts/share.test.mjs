import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildChallengeUrl,
  buildShareText,
  parseChallengeUrl
} from '../src/share.js';

test('builds a clean challenge URL', () => {
  const url = buildChallengeUrl(
    'https://example.com/neonflight/?old=1#section',
    'storm-circuit',
    62.3456
  );
  const parsed = new URL(url);

  assert.equal(parsed.origin, 'https://example.com');
  assert.equal(parsed.pathname, '/neonflight/');
  assert.equal(parsed.searchParams.get('course'), 'storm-circuit');
  assert.equal(parsed.searchParams.get('target'), '62.346');
  assert.equal(parsed.searchParams.get('old'), '1');
  assert.equal(parsed.hash, '');
});

test('parses valid challenges and rejects unknown courses', () => {
  const valid = parseChallengeUrl(
    'https://example.com/?course=storm-circuit&target=61.5',
    ['downtown-dash', 'storm-circuit']
  );
  assert.deepEqual(valid, { courseId: 'storm-circuit', target: 61.5 });

  const invalid = parseChallengeUrl(
    'https://example.com/?course=missing&target=-4',
    ['downtown-dash']
  );
  assert.deepEqual(invalid, { courseId: null, target: null });
});

test('handles malformed URLs safely', () => {
  assert.deepEqual(parseChallengeUrl('not a url'), {
    courseId: null,
    target: null
  });
});

test('formats share text with the course and time', () => {
  assert.equal(
    buildShareText('STORM CIRCUIT', 62.5),
    'STORM CIRCUIT cleared in 01:02.500. Can you beat it?'
  );
});
