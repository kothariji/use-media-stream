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
 *
 * ponytail: replaces the `deepmerge` dependency for the sake of one call. Behaves the same on
 * plain objects; arrays are replaced rather than concatenated, since concatenating something
 * like `deviceId: { exact: [...] }` across a merge produces a constraint nobody asked for.
 */
export const mergeConstraints = (
  base: MediaStreamConstraints,
  override: MediaStreamConstraints,
): MediaStreamConstraints => mergePlain(base as PlainObject, override as PlainObject) as MediaStreamConstraints;

// getUserMedia and enumerateDevices reject with DOMException, so this all but always passes
// the value straight through — it just spares every consumer an `instanceof` narrowing.
export const toError = (value: unknown): Error => (value instanceof Error ? value : new Error(String(value)));

export const tracksOf = (mediaStream: MediaStream | null | undefined, kind: TrackKind): MediaStreamTrack[] =>
  !mediaStream ? [] : kind === 'audio' ? mediaStream.getAudioTracks() : mediaStream.getVideoTracks();
