import { describe, expect, it } from 'vitest';
import { request } from './helpers';

describe('unauthenticated boundary', () => {
  it('rejects API requests without a session', async () => {
    const books = await request('/api/books');
    expect(books.status).toBe(401);
    expect(await books.json()).toEqual({ error: 'Unauthorized' });

    const works = await request('/api/works', {
      method: 'POST',
      body: { title: 'Unauthenticated Work' },
    });
    expect(works.status).toBe(401);
    expect(await works.json()).toEqual({ error: 'Unauthorized' });
  });

  it('redirects page requests without a session to the login page', async () => {
    for (const path of ['/books', '/works', '/works/new']) {
      const response = await request(path);
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/login');
    }
  });

  it('serves the login page without a session', async () => {
    const response = await request('/login');
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('PageTurn');
  });
});
