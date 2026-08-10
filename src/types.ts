import type { REQUEST_STATES } from './constants.js';

/** `'IDLE' | 'PENDING' | 'FULFILLED' | 'REJECTED'` — derived, so it cannot drift from the values. */
export type RequestState = (typeof REQUEST_STATES)[keyof typeof REQUEST_STATES];

export interface UseMediaStreamProps {
  /** Constraints for the media device, merged over the defaults. */
  mediaDeviceConstraints?: MediaStreamConstraints | null;
}

export interface UpdateMediaDeviceConstraintsOptions {
  /** Constraints to merge over the current ones. */
  constraints: MediaStreamConstraints;
  /** Re-acquire the stream with the updated constraints. Defaults to `false`. */
  resetStream?: boolean;
}

export type TrackKind = 'audio' | 'video';

/** Track events the hook can attach consumer listeners to. */
export type TrackEvent = 'ended' | 'mute' | 'unmute';
