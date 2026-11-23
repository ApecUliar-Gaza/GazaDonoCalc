import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, parsePieces } from '../public/js/chat.js';

test('parseMoney understands everyday amounts', () => {
  assert.equal(parseMoney('12k'), 12000);
  assert.equal(parseMoney('£5,000'), 5000);
  assert.equal(parseMoney('about 2.5k'), 2500);
  assert.equal(parseMoney('1.2m'), 1200000);
  assert.equal(parseMoney('none'), 0);
  assert.equal(parseMoney('no idea'), null);
  assert.equal(parseMoney("I don't know"), null);
  assert.equal(parseMoney('not a number'), null);
  assert.equal(parseMoney('3 grand'), 3000);
});

test('parsePieces counts gold pieces', () => {
  assert.deepEqual(parsePieces('2 bangles, a necklace and three rings'), [
    { piece: 'bangle', count: 2 }, { piece: 'necklace', count: 1 }, { piece: 'ring', count: 3 },
  ]);
  assert.deepEqual(parsePieces('a pair of earrings and 2 gold sovereigns'), [{ piece: 'earrings', count: 1 }, { piece: 'coin', count: 2 }]);
  assert.deepEqual(parsePieces('nothing'), []);
});
