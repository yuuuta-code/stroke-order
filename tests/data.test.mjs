import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const words = JSON.parse(await readFile(new URL('../data/words.json', import.meta.url)));
const glyphs = JSON.parse(await readFile(new URL('../data/glyphs.json', import.meta.url)));

test('57語のすべての漢字が100字の書き順データに対応する', () => {
  assert.equal(words.length, 57);
  const characters = new Set(words.flatMap(w => [...w.word]));
  assert.equal(characters.size, 100);
  assert.equal(Object.keys(glyphs).length, 100);
  for (const word of words) {
    assert.ok(word.reading.length > 0);
    assert.ok(['暮らし','ことば','自然','食べもの','生きもの'].includes(word.category));
  }
  for (const character of characters) {
    assert.ok(glyphs[character].length > 0);
    for (const path of glyphs[character]) {
      assert.match(path, /^[Mm]/);
      assert.doesNotMatch(path, /NaN|undefined/);
    }
  }
});

test('代表字の画数が正しい', () => {
  for (const [character, count] of Object.entries({挨:10,拶:9,憂:15,鬱:29,薔:16,薇:16,山:3,五:4,月:4})) {
    assert.equal(glyphs[character].length, count, character);
  }
});
