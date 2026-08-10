import { describe, expect, it } from 'vitest';
import { mergeConstraints } from '../src/utils.js';

const defaults: MediaStreamConstraints = {
  audio: { deviceId: '' },
  video: { facingMode: 'user', width: 1280, height: 720, frameRate: { ideal: 60, min: 10 }, deviceId: '' },
};

describe('mergeConstraints', () => {
  it('keeps defaults the override does not mention', () => {
    const merged = mergeConstraints(defaults, { video: { width: 640 } });
    expect(merged.video).toMatchObject({ width: 640, height: 720, facingMode: 'user' });
  });

  it('merges nested constraints rather than replacing them', () => {
    // the behaviour deepmerge gave us: `min` survives an override of `ideal`
    const merged = mergeConstraints(defaults, { video: { frameRate: { ideal: 30 } } });
    expect(merged.video).toMatchObject({ frameRate: { ideal: 30, min: 10 } });
  });

  it('lets a boolean replace an object, and vice versa', () => {
    expect(mergeConstraints(defaults, { audio: false }).audio).toBe(false);
    expect(mergeConstraints({ audio: false }, { audio: { deviceId: 'mic' } }).audio).toEqual({ deviceId: 'mic' });
  });

  it('replaces arrays instead of concatenating them', () => {
    const base: MediaStreamConstraints = { video: { deviceId: { exact: ['a'] } } };
    const merged = mergeConstraints(base, { video: { deviceId: { exact: ['b'] } } });
    expect(merged.video).toEqual({ deviceId: { exact: ['b'] } });
  });

  it('does not mutate either input', () => {
    const base = structuredClone(defaults);
    const override: MediaStreamConstraints = { video: { width: 320 } };
    mergeConstraints(base, override);
    expect(base).toEqual(defaults);
    expect(override).toEqual({ video: { width: 320 } });
  });

  it('is a no-op for an empty override', () => {
    expect(mergeConstraints(defaults, {})).toEqual(defaults);
  });
});
