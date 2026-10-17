import { afterEach, describe, expect, it, vi } from 'vitest';
import { regionTiming, serverTimingHeader } from './server-timing';
import { describeSupabaseCall, SLOW_SUPABASE_CALL_MS, timedFetch } from './timed-fetch';

const base = 'https://abc.supabase.co';

describe('serverTimingHeader', () => {
  it('formats durations and descriptions', () => {
    expect(
      serverTimingHeader([
        { name: 'auth', dur: 12.345, desc: 'session check' },
        { name: 'region', desc: 'hnd1' },
      ]),
    ).toBe('auth;dur=12.3;desc="session check", region;desc="hnd1"');
  });

  it('keeps descriptions inside their quotes', () => {
    expect(serverTimingHeader([{ name: 'x', desc: 'a"b\\c\nd' }])).toBe('x;desc="abcd"');
  });
});

describe('regionTiming', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('reports the Vercel region only when there is one', () => {
    vi.stubEnv('VERCEL_REGION', '');
    expect(regionTiming()).toEqual([]);
    vi.stubEnv('VERCEL_REGION', 'hnd1');
    expect(regionTiming()).toEqual([{ name: 'region', desc: 'hnd1' }]);
  });
});

describe('describeSupabaseCall', () => {
  it('names the service and path without the query string', () => {
    expect(describeSupabaseCall('GET', `${base}/auth/v1/user`)).toBe('auth GET /user');
    expect(describeSupabaseCall('GET', `${base}/rest/v1/projects?select=*&id=eq.secret`)).toBe(
      'rest GET projects',
    );
    expect(describeSupabaseCall('POST', `${base}/rest/v1/rpc/get_published_project`)).toBe(
      'rpc get_published_project',
    );
    expect(describeSupabaseCall('GET', `${base}/storage/v1/object/public/models/a/b.glb`)).toBe(
      'storage GET',
    );
    expect(describeSupabaseCall('GET', 'not a url')).toBe('GET (invalid URL)');
  });
});

describe('timedFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function setup(ms: number) {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        now += ms;
        return new Response('{}');
      }),
    );
    return vi.spyOn(console, 'warn').mockImplementation(() => {});
  }

  it('logs slow calls with the function region', async () => {
    vi.stubEnv('VERCEL_REGION', 'iad1');
    const warn = setup(SLOW_SUPABASE_CALL_MS + 400);
    await timedFetch()(`${base}/rest/v1/projects?select=id`, { method: 'GET' });
    expect(warn).toHaveBeenCalledWith(
      '[perf] supabase rest GET projects 700 ms (function region iad1)',
    );
  });

  it('stays quiet for fast calls unless PERF_LOG=1', async () => {
    vi.stubEnv('VERCEL_REGION', '');
    const warn = setup(20);
    await timedFetch()(new Request(`${base}/auth/v1/user`));
    expect(warn).not.toHaveBeenCalled();
    vi.stubEnv('PERF_LOG', '1');
    await timedFetch()(new Request(`${base}/auth/v1/user`));
    expect(warn).toHaveBeenCalledWith('[perf] supabase auth GET /user 20 ms');
  });
});
