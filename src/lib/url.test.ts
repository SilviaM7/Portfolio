import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assetUrl, safeHttpsUrl } from './url';

describe('assetUrl (respects the deployment base path)', () => {
  it('works for a user/organization site', () => {
    assert.equal(assetUrl('data/ai-spend/usage_events.csv', '/'), '/data/ai-spend/usage_events.csv');
  });
  it('works for a repository sub-path, with or without a trailing slash', () => {
    assert.equal(assetUrl('data/x.csv', '/portfolio/'), '/portfolio/data/x.csv');
    assert.equal(assetUrl('data/x.csv', '/portfolio'), '/portfolio/data/x.csv');
  });
  it('ignores a leading slash on the path', () => {
    assert.equal(assetUrl('/documents/cv.pdf', '/portfolio/'), '/portfolio/documents/cv.pdf');
  });
});

describe('safeHttpsUrl', () => {
  it('accepts https URLs', () => assert.equal(safeHttpsUrl(' https://github.com/user '), 'https://github.com/user'));
  it('rejects empty, relative, http, javascript, and malformed values', () => {
    for (const bad of ['', '   ', 'github.com/user', 'http://example.com', 'javascript:alert(1)', 'data:text/html,hi', '[your-link]']) {
      assert.equal(safeHttpsUrl(bad), null, JSON.stringify(bad));
    }
  });
});
