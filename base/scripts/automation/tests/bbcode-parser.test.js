// BBCode Parser Test Suite

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as BBCodeParser from '../lib/bbcode-parser.js';
import { testCases } from './test-cases.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

const LEAKED_PATTERNS = [
  /\[list\]|\[\/list\]/,
  /\[olist\]|\[\/olist\]/,
  /\[\*\]|\[\/\*\]/,
  /<\*>|<\/\*>/,
  /\[color=/,
  /\[expand/,
  /## \$2/,
  /# \$1/,
];

function assertNoLeakedBBCode(markdown, context) {
  for (const pattern of LEAKED_PATTERNS) {
    assert.ok(!pattern.test(markdown), `${context}: leaked ${pattern}`);
  }
}

// =============================================================================
// Test Cases
// =============================================================================

describe('BBCode Parser', () => {
  for (const tc of testCases) {
    it(tc.name, () => {
      const actual = BBCodeParser.bbcodeToMarkdown(tc.bbcode).trim().replace(/\r\n/g, '\n');
      const expected = tc.expected.trim().replace(/\r\n/g, '\n');
      assert.equal(actual, expected);
    });
  }
});

// =============================================================================
// Fixture Validation
// =============================================================================

describe('Fixtures', () => {
  let fixtures = [];

  before(() => {
    const games = fs.readdirSync(FIXTURES_DIR).filter(f => {
      const p = path.join(FIXTURES_DIR, f);
      return fs.statSync(p).isDirectory() && f !== 'out';
    });

    for (const game of games) {
      const gameDir = path.join(FIXTURES_DIR, game);
      for (const file of fs.readdirSync(gameDir).filter(f => f.endsWith('.bbcode'))) {
        const id = file.replace('.bbcode', '');
        fixtures.push({
          name: `${game}/${id}`,
          bbcode: fs.readFileSync(path.join(gameDir, file), 'utf8'),
        });
      }
    }
  });

  it('all fixtures convert without leaking BBCode', () => {
    assert.ok(fixtures.length > 0, 'fixtures loaded');
    for (const f of fixtures) {
      const markdown = BBCodeParser.bbcodeToMarkdown(f.bbcode);
      assertNoLeakedBBCode(markdown, f.name);
    }
  });
});
