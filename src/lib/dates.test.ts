import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addDays,
  addMonths,
  addMonthsToDate,
  daysBetween,
  daysInMonth,
  formatDate,
  formatMonth,
  isWeekend,
  monthRange,
  parseIsoDate,
  parseMonth,
  quarterOf,
} from './dates';

describe('parseIsoDate', () => {
  it('accepts real calendar dates', () => {
    assert.equal(parseIsoDate('2026-09-27'), '2026-09-27');
    assert.equal(parseIsoDate(' 2024-02-29 '), '2024-02-29'); // leap day
  });
  it('rejects malformed or impossible dates instead of rolling them over', () => {
    for (const bad of ['2026-02-30', '2026-13-01', '2026-00-10', '2025-02-29', '27/09/2026', '2026-9-7', '', 'not a date']) {
      assert.equal(parseIsoDate(bad), null, bad);
    }
    assert.equal(parseIsoDate(undefined), null);
    assert.equal(parseIsoDate(null), null);
  });
});

describe('parseMonth', () => {
  it('validates YYYY-MM', () => {
    assert.equal(parseMonth('2026-09'), '2026-09');
    assert.equal(parseMonth('2026-13'), null);
    assert.equal(parseMonth('2026-9'), null);
  });
});

describe('date arithmetic is calendar based and timezone independent', () => {
  it('adds days across month and year boundaries', () => {
    assert.equal(addDays('2026-01-31', 1), '2026-02-01');
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  });
  it('counts whole days, including across daylight-saving changes', () => {
    assert.equal(daysBetween('2026-03-07', '2026-03-09'), 2); // US DST starts 2026-03-08
    assert.equal(daysBetween('2026-11-01', '2026-11-02'), 1); // US DST ends 2026-11-01
    assert.equal(daysBetween('2026-09-27', '2026-09-20'), -7);
  });
  it('adds months and clamps day-of-month', () => {
    assert.equal(addMonths('2026-11', 3), '2027-02');
    assert.equal(addMonths('2026-01', -1), '2025-12');
    assert.equal(addMonthsToDate('2026-01-31', 1), '2026-02-28');
    assert.equal(addMonthsToDate('2026-09-27', 12), '2027-09-27');
  });
  it('knows month lengths and ranges', () => {
    assert.equal(daysInMonth('2024-02'), 29);
    assert.equal(daysInMonth('2026-02'), 28);
    assert.deepEqual(monthRange('2026-11', '2027-01'), ['2026-11', '2026-12', '2027-01']);
    assert.deepEqual(monthRange('2026-05', '2026-04'), []);
  });
  it('identifies weekends and quarters', () => {
    assert.equal(isWeekend('2026-09-26'), true); // Saturday
    assert.equal(isWeekend('2026-09-28'), false); // Monday
    assert.equal(quarterOf('2026-09-30'), '2026-Q3');
    assert.equal(quarterOf('2026-01-01'), '2026-Q1');
  });
});

describe('formatting never shifts the calendar day', () => {
  it('formats dates and months in UTC', () => {
    assert.equal(formatDate('2026-01-01'), 'Jan 1, 2026');
    assert.equal(formatDate('2026-12-31'), 'Dec 31, 2026');
    assert.equal(formatMonth('2026-09'), 'Sep 2026');
  });
});
