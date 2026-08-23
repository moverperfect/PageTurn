import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  deleteFixtures,
  promoteToAdmin,
  request,
  signInFixture,
  signUpFixture,
  type Fixture,
} from './helpers';

describe('administrator access', () => {
  let admin: Fixture;
  let reader: Fixture;

  beforeAll(async () => {
    admin = await signUpFixture('admin');
    reader = await signUpFixture('reader');
    promoteToAdmin(admin);
    // Re-authenticate after promotion so the session reflects the admin role.
    admin.cookie = await signInFixture(admin);
  });

  afterAll(() => {
    deleteFixtures([admin, reader]);
  });

  it('shows the admin dashboard to an administrator', async () => {
    const response = await request('/admin', { cookie: admin.cookie });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('User Administration');
  });

  it('redirects a plain Reader away from the admin dashboard', async () => {
    const response = await request('/admin', { cookie: reader.cookie });
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/');
  });

  it('redirects unauthenticated visitors to the login page', async () => {
    const response = await request('/admin');
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/login');
  });
});
