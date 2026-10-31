import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { categoriesOf, EMPTY_GALLERY_FILTERS, filterProjects } from './gallery';
import { projects } from './registry';

const ids = (query: string, category: Parameters<typeof filterProjects>[1]['category'] = null) => filterProjects(projects, { query, category }).map((p) => p.id);

describe('gallery filtering', () => {
  it('returns everything with no filters', () => assert.equal(filterProjects(projects, EMPTY_GALLERY_FILTERS).length, projects.length));
  it('matches words in titles, tags, and methods, case-insensitively', () => {
    assert.deepEqual(ids('LICENSE'), ['ai-adoption']);
    assert.deepEqual(ids('payback'), ['ai-workflow']);
    assert.deepEqual(ids('budget variance'), ['ai-spend']);
  });
  it('requires every word to match', () => {
    assert.deepEqual(ids('budget payback'), []);
  });
  it('filters by category and combines it with search', () => {
    assert.deepEqual(ids('', 'Adoption & utilization'), ['ai-adoption']);
    assert.deepEqual(ids('budget', 'Adoption & utilization'), []);
  });
  it('ignores extra whitespace', () => assert.deepEqual(ids('  cost   '), ids('cost')));
  it('lists each category once', () => assert.equal(categoriesOf(projects).length, new Set(projects.map((p) => p.category)).size));
});
