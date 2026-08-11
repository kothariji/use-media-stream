import type { TrackKind } from './types.js';

type PlainObject = Record<string, unknown>;

const isPlainObject = (value: unknown): value is PlainObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const mergePlain = (base: PlainObject, override: PlainObject): PlainObject => {
  const merged: PlainObject = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = merged[key];
    merged[key] = isPlainObject(existing) && isPlainObject(value) ? mergePlain(existing, value) : value;
  }
  return merged;
};

/**
 * Recursively merges constraints, so `{ video: { width: 640 } }` keeps the default `facingMode`.
 * Arrays are replaced, not concatenated: merging `deviceId: { exact: [...] }` twice should not
 * produce a constraint matching both devices.
 */
export const mergeConstraints = (
  base: MediaStreamConstraints,
  override: MediaStreamConstraints,
): MediaStreamConstraints => mergePlain(base as PlainObject, override as PlainObject) as MediaStreamConstraints;

// Spares every consumer an `instanceof` narrowing; media APIs reject with DOMException anyway.
export const toError = (value: unknown): Error => (value instanceof Error ? value : new Error(String(value)));

export const tracksOf = (mediaStream: MediaStream | null | undefined, kind: TrackKind): MediaStreamTrack[] =>
  !mediaStream ? [] : kind === 'audio' ? mediaStream.getAudioTracks() : mediaStream.getVideoTracks();
