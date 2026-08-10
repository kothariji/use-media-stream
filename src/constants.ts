/** Possible states of an async request exposed by the hook. */
export const REQUEST_STATES = {
  IDLE: 'IDLE',
  PENDING: 'PENDING',
  FULFILLED: 'FULFILLED',
  REJECTED: 'REJECTED',
} as const;

/** Default media device constraints for initializing a media stream. */
export const defaultMediaDeviceConstraints: MediaStreamConstraints = {
  audio: {
    deviceId: '',
  },
  video: {
    facingMode: 'user',
    width: 1280,
    height: 720,
    frameRate: {
      ideal: 60,
      min: 10,
    },
    deviceId: '',
  },
};
