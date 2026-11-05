import { describe, expect, it } from 'vitest';
import { allowedOrigins, corsHeaders } from './cors';

describe('corsHeaders', () => {
  const allowed = ['http://localhost:8081', 'https://prepio.example'];
  it('echoes an allowed origin', () => {
    const h = corsHeaders('http://localhost:8081', allowed);
    expect(h['Access-Control-Allow-Origin']).toBe('http://localhost:8081');
    expect(h['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
    expect(h['Access-Control-Allow-Headers']).toBe('Content-Type, Authorization');
    expect(h.Vary).toContain('Origin');
  });
  it('gives no ACAO header to other origins or when absent', () => {
    expect(corsHeaders('https://evil.example', allowed)['Access-Control-Allow-Origin']).toBeUndefined();
    expect(corsHeaders(null, allowed)['Access-Control-Allow-Origin']).toBeUndefined();
    expect(corsHeaders('https://evil.example', allowed).Vary).toBe('Origin');
  });
});

describe('allowedOrigins', () => {
  it('splits and trims the env list, defaulting to the local web app', () => {
    expect(allowedOrigins(' https://a.example , https://b.example,, ')).toEqual(['https://a.example', 'https://b.example']);
    expect(allowedOrigins(undefined)).toEqual(['http://localhost:8081']);
  });
});
