import { describe, expect, it } from 'vitest';
import { request } from './helpers';

describe('unauthenticated boundary', () => {
  it('rejects API requests without a session', async () => {
    const response = await request('/api/books');
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('redirects page requests without a session to the login page', async () => {
    const response = await request('/books');
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/login');
  });

  it('serves the login page without a session', async () => {
    const response = await request('/login');
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('PageTurn');
  });
});
