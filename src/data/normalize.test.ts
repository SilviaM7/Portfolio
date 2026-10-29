import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DataError, IssueLog } from './errors';
import { parseCount, parseEnum, parseNumber, parseText, requireColumns, requireRows } from './normalize';

describe('parseNumber', () => {
  it('parses plain decimal numbers', () => {
    assert.equal(parseNumber('12'), 12);
    assert.equal(parseNumber(' -3.5 '), -3.5);
    assert.equal(parseNumber('.5'), 0.5);
    assert.equal(parseNumber('0'), 0);
  });
  it('returns null (never 0) for blank, invalid, or ambiguous input', () => {
    for (const bad of ['', '   ', 'abc', '12abc', '1,234', 'NaN', 'Infinity', '1e3', '--1', '$5']) {
      assert.equal(parseNumber(bad), null, JSON.stringify(bad));
    }
    assert.equal(parseNumber(undefined), null);
    assert.equal(parseNumber(null), null);
  });
});

describe('parseCount', () => {
  it('accepts non-negative whole numbers only', () => {
    assert.equal(parseCount('42'), 42);
    assert.equal(parseCount('0'), 0);
    assert.equal(parseCount('-1'), null);
    assert.equal(parseCount('2.5'), null);
    assert.equal(parseCount(''), null);
  });
});

describe('parseText and parseEnum', () => {
  it('trims text and turns blanks into null', () => {
    assert.equal(parseText('  hi '), 'hi');
    assert.equal(parseText('   '), null);
  });
  it('matches enums case-insensitively and returns the canonical value', () => {
    assert.equal(parseEnum(' SUCCESS ', ['success', 'failed'] as const), 'success');
    assert.equal(parseEnum('maybe', ['success', 'failed'] as const), null);
    assert.equal(parseEnum('', ['success', 'failed'] as const), null);
  });
});

describe('requireColumns and requireRows', () => {
  it('throws a DataError naming the missing columns', () => {
    assert.throws(
      () => requireColumns('x.csv', ['a', 'b'], ['a', 'b', 'c']),
      (error: unknown) => error instanceof DataError && /missing required column: c/.test(error.message) && error.details.length > 0,
    );
  });
  it('passes when all columns are present, ignoring extra columns', () => {
    assert.doesNotThrow(() => requireColumns('x.csv', ['a', 'b', 'extra'], ['a', 'b']));
  });
  it('throws a helpful error when no rows survive', () => {
    assert.throws(() => requireRows('x.csv', []), DataError);
    assert.doesNotThrow(() => requireRows('x.csv', [1]));
  });
});

describe('IssueLog', () => {
  it('counts by code and keeps a few sample rows', () => {
    const log = new IssueLog();
    for (let i = 1; i <= 8; i++) log.add('bad', 'Bad value', i);
    log.add('other', 'Other', 2);
    const [first, second] = log.toArray();
    assert.equal(first?.code, 'bad');
    assert.equal(first?.count, 8);
    assert.deepEqual(first?.sampleRows, [1, 2, 3, 4, 5]);
    assert.equal(second?.count, 1);
  });
});
