import { buildSupabaseClient, missingSupabaseConfigMessage, readSupabasePublicConfig } from '../supabaseClient';

describe('supabase public config', () => {
  it('treats a blank URL or key as unconfigured', () => {
    expect(readSupabasePublicConfig({})).toEqual({ url: '', anonKey: '', configured: false });
    expect(readSupabasePublicConfig({
      EXPO_PUBLIC_SUPABASE_URL: '  ',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'key',
    }).configured).toBe(false);
  });

  it('keeps a trimmed URL and anon key when both are set', () => {
    expect(readSupabasePublicConfig({
      EXPO_PUBLIC_SUPABASE_URL: ' https://example.supabase.co ',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: ' anon-key ',
    })).toEqual({
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
      configured: true,
    });
  });

  it('does not call the Supabase constructor when the build has no config', () => {
    const create = jest.fn(() => ({ auth: {} }));
    expect(buildSupabaseClient({ configured: false }, create, {})).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('builds a client only after both public values are present', () => {
    const create = jest.fn(() => ({ auth: {} }));
    const options = { auth: { persistSession: true } };
    const client = buildSupabaseClient({
      configured: true,
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
    }, create, options);
    expect(client).toEqual({ auth: {} });
    expect(create).toHaveBeenCalledWith('https://example.supabase.co', 'anon-key', options);
  });

  it('names the two EAS variables a preview build needs', () => {
    const message = missingSupabaseConfigMessage();
    expect(message.title).toMatch(/could not start/i);
    expect(message.body).toContain('EXPO_PUBLIC_SUPABASE_URL');
    expect(message.body).toContain('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  });
});

describe('supabase module import', () => {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  afterEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = url;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = key;
  });

  it('stays loadable when the public env vars are missing', () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    jest.isolateModules(() => {
      let loaded;
      expect(() => {
        loaded = require('../supabase');
      }).not.toThrow();
      expect(loaded.supabase).toBeNull();
      expect(loaded.supabaseConfig.configured).toBe(false);
    });
  });
});
