import { useCallback, useEffect, useRef, useState } from 'react';
import { REQUEST_STATES } from './constants';

/**
 * Represents the configuration for using a media stream
 */
interface useMediaStreamInterface {
  /**
   * The constraints for the media device to be used in the media stream.
   * @type {MediaStreamConstraints | null}
   */
  mediaDeviceConstraints: MediaStreamConstraints | null;
}

/**
 * Default media device constraints for initializing a media stream.
 * @type {MediaStreamConstraints}
 */
const defaultMediaDeviceConstraints: MediaStreamConstraints = {
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

type TrackKind = 'audio' | 'video';

const tracksOf = (mediaStream: MediaStream | null | undefined, kind: TrackKind): MediaStreamTrack[] =>
  !mediaStream ? [] : kind === 'audio' ? mediaStream.getAudioTracks() : mediaStream.getVideoTracks();

/**
 * React hook for managing and integrating media streams within your application.
 */
const useMediaStream = (props?: useMediaStreamInterface) => {
  // check if the browser supports `getUserMedia`
  const isSupported = !!navigator?.mediaDevices?.getUserMedia;
  const [mediaDeviceConstraints, setMediaDeviceConstraints] = useState(() =>
    mergeConstraints(defaultMediaDeviceConstraints, props?.mediaDeviceConstraints ?? {}),
  );
  const [getStreamRequest, setGetStreamRequest] = useState(REQUEST_STATES.IDLE);
  const [getMediaDevicesRequest, setGetMediaDevicesRequest] = useState(REQUEST_STATES.IDLE);

  // `isStreaming` is a flag that holds true when the start() function is called.
  const [isStreaming, setIsStreaming] = useState(false);

  //global state for capturing any error in while fetching the stream or devices
  const [error, setError] = useState<unknown>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  // State drives re-renders of the derived values below; the ref mirror is what teardown
  // reads, since it must see the live stream rather than the last committed render.
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const audioInputDevices: MediaDeviceInfo[] = [];
  const audioOutputDevices: MediaDeviceInfo[] = [];
  const videoInputDevices: MediaDeviceInfo[] = [];

  devices.forEach((d: MediaDeviceInfo) => {
    if (d.kind === 'audioinput') {
      audioInputDevices.push(d);
    } else if (d.kind === 'audiooutput') {
      audioOutputDevices.push(d);
    } else if (d.kind === 'videoinput') {
      videoInputDevices.push(d);
    }
  });

  const selectedAudioDeviceTrack = stream?.getAudioTracks()[0];
  const selectedVideoDeviceTrack = stream?.getVideoTracks()[0];
  const selectedAudioDeviceTrackSettings = selectedAudioDeviceTrack?.getSettings();
  const selectedVideoDeviceTrackSettings = selectedVideoDeviceTrack?.getSettings();
  const selectedAudioTrackDeviceId = selectedAudioDeviceTrackSettings?.deviceId;
  const selectedVideoTrackDeviceId = selectedVideoDeviceTrackSettings?.deviceId;
  const selectedVideoTrackDeviceWidth = selectedVideoDeviceTrackSettings?.width;
  const selectedVideoTrackDeviceHeight = selectedVideoDeviceTrackSettings?.height;
  const selectedVideoTrackDeviceAspectRatio = selectedVideoDeviceTrackSettings?.aspectRatio;

  const handleOnVideoMuteEvent = useCallback(() => {
    setIsVideoMuted(true);
  }, []);

  const handleOnAudioMuteEvent = useCallback(() => {
    setIsAudioMuted(true);
  }, []);

  const handleOnVideoUnmuteEvent = useCallback(() => {
    setIsVideoMuted(false);
  }, []);

  const handleOnAudioUnmuteEvent = useCallback(() => {
    setIsAudioMuted(false);
  }, []);

  const handleOnVideoOrAudioEndedEvent = useCallback(() => {
    setIsStreaming(false);
  }, []);

  /** Attach or detach the built-in track listeners. One list, so both directions stay in sync. */
  const bindTrackEvents = useCallback(
    (userMediaStream: MediaStream, bind: 'addEventListener' | 'removeEventListener') => {
      tracksOf(userMediaStream, 'video').forEach((track) => {
        track[bind]('ended', handleOnVideoOrAudioEndedEvent);
        track[bind]('mute', handleOnVideoMuteEvent);
        track[bind]('unmute', handleOnVideoUnmuteEvent);
      });
      tracksOf(userMediaStream, 'audio').forEach((track) => {
        track[bind]('ended', handleOnVideoOrAudioEndedEvent);
        track[bind]('mute', handleOnAudioMuteEvent);
        track[bind]('unmute', handleOnAudioUnmuteEvent);
      });
    },
    [
      handleOnVideoOrAudioEndedEvent,
      handleOnVideoMuteEvent,
      handleOnVideoUnmuteEvent,
      handleOnAudioMuteEvent,
      handleOnAudioUnmuteEvent,
    ],
  );

  /** Reads the ref, not state, so it is correct when called in the same tick a stream is acquired. */
  const releaseStream = useCallback(() => {
    if (!streamRef.current) return;
    bindTrackEvents(streamRef.current, 'removeEventListener');
    streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, [bindTrackEvents]);

  // Without this the camera and mic stay live until the tab closes.
  // `releaseStream` is stable (every handler it closes over has empty deps), so this only runs on unmount.
  useEffect(() => releaseStream, [releaseStream]);

  /** Acquires a stream. Resolves to `null` rather than throwing; the reason lands in `error`. */
  const initiateStream = async (
    mediaDeviceConstraintsFromArgs = mediaDeviceConstraints,
  ): Promise<MediaStream | null> => {
    // resetting the error state
    setError(null);

    // Guarded here rather than per-caller: `start` and `getMediaDevices` both route through this.
    if (!isSupported) {
      setGetStreamRequest(REQUEST_STATES.REJECTED);
      setError(new Error('getUserMedia is not supported in this browser'));
      return null;
    }

    setGetStreamRequest(REQUEST_STATES.PENDING);

    try {
      const userMediaStream: MediaStream = await navigator.mediaDevices.getUserMedia(mediaDeviceConstraintsFromArgs);

      // track the stream ending or going silent on its own
      bindTrackEvents(userMediaStream, 'addEventListener');
      streamRef.current = userMediaStream;
      setStream(userMediaStream);
      setGetStreamRequest(REQUEST_STATES.FULFILLED);
      return userMediaStream;
    } catch (e: unknown) {
      setGetStreamRequest(REQUEST_STATES.REJECTED);
      setError(e);
      return null;
    }
  };

  /** Starts the media stream if not already streaming. */
  const start = async (): Promise<MediaStream | null> => {
    if (isStreaming) return streamRef.current;

    let mediaStream = streamRef.current;

    if (!mediaStream) {
      mediaStream = await initiateStream();
    }

    if (mediaStream) {
      /**
       * Set `isStreaming` explicitly in the `start` function to clarify that it's triggered by user call to start().
       * Avoid setting it in `initiateStream` to prevent confusion as `initiateStream` is called by other functions like `getMediaDevices` also.
       */
      setIsStreaming(true);
    }

    return mediaStream;
  };

  /**
   * Releases the media stream and resets stream-related state.
   *
   * Guards on the stream, not `isStreaming`: `getMediaDevices` acquires a stream without ever
   * setting that flag, so keying off it left those tracks running with no way to release them.
   */
  const stop = (): void => {
    if (!streamRef.current) return;

    releaseStream(); // owns the ref
    setStream(null);
    setIsStreaming(false);
    setGetStreamRequest(REQUEST_STATES.IDLE);
    setError(null);
  };

  /**
   * Lists available media devices, acquiring a stream first because device labels stay blank
   * until permission is granted — see https://stackoverflow.com/a/65366422/12383316
   *
   * The stream it opens is released by `stop()` like any other.
   */
  const getMediaDevices = async (): Promise<MediaDeviceInfo[]> => {
    setError(null);
    setGetMediaDevicesRequest(REQUEST_STATES.PENDING);

    try {
      // `initiateStream` owns the isSupported check and populates `error` if it fails
      if (!streamRef.current && !(await initiateStream())) {
        setGetMediaDevicesRequest(REQUEST_STATES.REJECTED);
        return [];
      }

      const devices: MediaDeviceInfo[] = await navigator.mediaDevices.enumerateDevices();
      setDevices(devices);
      setGetMediaDevicesRequest(REQUEST_STATES.FULFILLED);
      return devices;
    } catch (e: unknown) {
      setGetMediaDevicesRequest(REQUEST_STATES.REJECTED);
      setError(e);
      return [];
    }
  };

  /** Merges new constraints over the current ones, optionally re-acquiring the stream with them. */
  const updateMediaDeviceConstraints = async ({
    constraints,
    resetStream = false,
  }: {
    constraints: MediaStreamConstraints;
    resetStream: boolean;
  }) => {
    const updatedUserMediaConstraints = mergeConstraints(mediaDeviceConstraints, constraints);
    setMediaDeviceConstraints(updatedUserMediaConstraints);

    if (!resetStream) return;

    // Constraints are passed explicitly below because the state update above has not flushed yet.
    const wasStreaming = isStreaming;
    stop();
    const updatedStream = await initiateStream(updatedUserMediaConstraints);
    setIsStreaming(wasStreaming && !!updatedStream);
  };

  /** Toggles `track.enabled`, which keeps the device open but stops it producing data. */
  const setTracksEnabled = (kind: TrackKind, enabled: boolean): void => {
    tracksOf(streamRef.current, kind).forEach((track) => (track.enabled = enabled));
    (kind === 'audio' ? setIsAudioMuted : setIsVideoMuted)(!enabled);
  };

  const muteAudio = (): void => setTracksEnabled('audio', false);
  const unmuteAudio = (): void => setTracksEnabled('audio', true);
  const muteVideo = (): void => setTracksEnabled('video', false);
  const unmuteVideo = (): void => setTracksEnabled('video', true);

  // Consumer-supplied 'ended' and 'mute' listeners. These apply to the tracks held right now,
  // so they need re-adding after any call that replaces the stream.
  const bind =
    (kind: TrackKind, event: 'ended' | 'mute', action: 'addEventListener' | 'removeEventListener') =>
    (fn: EventListenerOrEventListenerObject): void =>
      tracksOf(streamRef.current, kind).forEach((track) => track[action](event, fn));

  const addVideoEndedEventListener = bind('video', 'ended', 'addEventListener');
  const addAudioEndedEventListener = bind('audio', 'ended', 'addEventListener');
  const addVideoMuteEventListener = bind('video', 'mute', 'addEventListener');
  const addAudioMuteEventListener = bind('audio', 'mute', 'addEventListener');
  const removeVideoEndedEventListener = bind('video', 'ended', 'removeEventListener');
  const removeAudioEndedEventListener = bind('audio', 'ended', 'removeEventListener');
  const removeVideoMuteEventListener = bind('video', 'mute', 'removeEventListener');
  const removeAudioMuteEventListener = bind('audio', 'mute', 'removeEventListener');

  return {
    stream,
    isSupported,
    isStreaming,
    isAudioMuted,
    isVideoMuted,

    devices,
    audioInputDevices,
    audioOutputDevices,
    videoInputDevices,
    selectedAudioTrackDeviceId,
    selectedVideoTrackDeviceId,
    selectedVideoTrackDeviceWidth,
    selectedVideoTrackDeviceHeight,
    selectedVideoTrackDeviceAspectRatio,

    getStreamRequest,
    getMediaDevicesRequest,

    error,

    // handlers
    start,
    stop,
    getMediaDevices,
    updateMediaDeviceConstraints,

    muteAudio,
    unmuteAudio,
    muteVideo,
    unmuteVideo,

    // event listeners
    addVideoEndedEventListener,
    addAudioEndedEventListener,
    addVideoMuteEventListener,
    addAudioMuteEventListener,
    removeVideoEndedEventListener,
    removeAudioEndedEventListener,
    removeVideoMuteEventListener,
    removeAudioMuteEventListener,
  };
};

export default useMediaStream;
