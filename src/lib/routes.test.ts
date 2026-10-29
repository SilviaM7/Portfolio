import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hrefs, parseHash } from './routes';

describe('parseHash', () => {
  it('treats empty and root hashes as home', () => {
    for (const hash of ['', '#', '#/', '/']) assert.deepEqual(parseHash(hash), { name: 'home' }, JSON.stringify(hash));
  });
  it('parses top-level pages', () => {
    assert.deepEqual(parseHash('#/projects'), { name: 'projects' });
    assert.deepEqual(parseHash('#/about'), { name: 'about' });
    assert.deepEqual(parseHash('#/contact'), { name: 'contact' });
    assert.deepEqual(parseHash('#/live-data'), { name: 'live-data' });
  });
  it('parses a project detail route and ignores a trailing slash or query string', () => {
    assert.deepEqual(parseHash('#/projects/ai-spend'), { name: 'project', id: 'ai-spend' });
    assert.deepEqual(parseHash('#/projects/ai-spend/'), { name: 'project', id: 'ai-spend' });
    assert.deepEqual(parseHash('#/projects/ai-spend?x=1'), { name: 'project', id: 'ai-spend' });
  });
  it('returns not-found for unknown or over-deep paths and malformed encodings', () => {
    assert.equal(parseHash('#/nope').name, 'not-found');
    assert.equal(parseHash('#/projects/a/b').name, 'not-found');
    assert.equal(parseHash('#/about/extra').name, 'not-found');
    assert.equal(parseHash('#/projects/%E0%A4%A').name, 'not-found');
  });
  it('round-trips generated hrefs', () => {
    assert.deepEqual(parseHash(hrefs.project('ai-adoption')), { name: 'project', id: 'ai-adoption' });
    assert.deepEqual(parseHash(hrefs.home), { name: 'home' });
  });
});
