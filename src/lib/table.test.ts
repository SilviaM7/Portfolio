import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { paginate, sortRows } from './table';

const rows = [
  { id: 'REQ-10', cost: 2 },
  { id: 'REQ-2', cost: null },
  { id: 'REQ-1', cost: 10 },
  { id: 'REQ-3', cost: 2 },
];

describe('sortRows', () => {
  it('sorts numbers numerically and puts missing values last in both directions', () => {
    assert.deepEqual(sortRows(rows, (r) => r.cost, 'asc').map((r) => r.id), ['REQ-10', 'REQ-3', 'REQ-1', 'REQ-2']);
    assert.deepEqual(sortRows(rows, (r) => r.cost, 'desc').map((r) => r.id), ['REQ-1', 'REQ-10', 'REQ-3', 'REQ-2']);
  });
  it('uses natural ordering for text and is stable for ties', () => {
    assert.deepEqual(sortRows(rows, (r) => r.id, 'asc').map((r) => r.id), ['REQ-1', 'REQ-2', 'REQ-3', 'REQ-10']);
    const ties = sortRows(rows, (r) => r.cost, 'asc').filter((r) => r.cost === 2).map((r) => r.id);
    assert.deepEqual(ties, ['REQ-10', 'REQ-3']); // original relative order kept
  });
  it('does not mutate its input', () => {
    const copy = [...rows];
    sortRows(rows, (r) => r.id, 'desc');
    assert.deepEqual(rows, copy);
  });
});

describe('paginate', () => {
  const data = Array.from({ length: 25 }, (_, i) => i + 1);
  it('returns the requested page with 1-based from/to', () => {
    const p = paginate(data, 2, 10);
    assert.deepEqual(p.rows, [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    assert.deepEqual([p.page, p.pageCount, p.total, p.from, p.to], [2, 3, 25, 11, 20]);
  });
  it('handles a short last page', () => {
    const p = paginate(data, 3, 10);
    assert.deepEqual([p.rows.length, p.from, p.to], [5, 21, 25]);
  });
  it('clamps out-of-range pages (for example after a filter shrinks the data)', () => {
    assert.equal(paginate(data, 99, 10).page, 3);
    assert.equal(paginate(data, 0, 10).page, 1);
    assert.equal(paginate(data, Number.NaN, 10).page, 1);
  });
  it('reports an empty result as page 1 of 1 with from = to = 0', () => {
    const p = paginate([], 1, 10);
    assert.deepEqual([p.page, p.pageCount, p.total, p.from, p.to, p.rows.length], [1, 1, 0, 0, 0, 0]);
  });
});
