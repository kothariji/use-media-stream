import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defaultMediaDeviceConstraints, REQUEST_STATES } from './constants.js';
import { mergeConstraints, toError, tracksOf } from './utils.js';
import type {
  RequestState,
  TrackEvent,
  TrackKind,
  UpdateMediaDeviceConstraintsOptions,
  UseMediaStreamProps,
} from './types.js';

/** React hook for managing and integrating media streams within your application. */
const useMediaStream = (props?: UseMediaStreamProps) => {
  // `typeof`, not `navigator?.` — optional chaining still throws on an undeclared identifier, and
  // Node had no global `navigator` before 21. Server rendering depends on this.
  const isSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const [mediaDeviceConstraints, setMediaDeviceConstraints] = useState(() =>
    mergeConstraints(defaultMediaDeviceConstraints, props?.mediaDeviceConstraints ?? {}),
  );
  // Annotated, or `as const` on REQUEST_STATES narrows these to the literal 'IDLE'.
  const [getStreamRequest, setGetStreamRequest] = useState<RequestState>(REQUEST_STATES.IDLE);
  const [getMediaDevicesRequest, setGetMediaDevicesRequest] = useState<RequestState>(REQUEST_STATES.IDLE);

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  // State for rendering; the ref for teardown, which must see the live stream rather than the
  // last committed render.
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // What the open stream was acquired with — its cache key. Reference comparison is exact:
  // `mergeConstraints` returns a fresh object on every change.
  const acquiredWith = useRef<MediaStreamConstraints | null>(null);
  const inFlight = useRef<{ constraints: MediaStreamConstraints; promise: Promise<MediaStream | null> } | null>(null);

  // Memoised for identity, not cost: a fresh array each render makes a consumer's
  // `useEffect(..., [audioInputDevices])` re-run forever.
  const { audioInputDevices, audioOutputDevices, videoInputDevices } = useMemo(
    () => ({
      audioInputDevices: devices.filter((d) => d.kind === 'audioinput'),
      audioOutputDevices: devices.filter((d) => d.kind === 'audiooutput'),
      videoInputDevices: devices.filter((d) => d.kind === 'videoinput'),
    }),
    [devices],
  );

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

  /** Reads the ref, not state, so it is correct in the same tick a stream is acquired. */
  const releaseStream = useCallback(() => {
    if (!streamRef.current) return;
    bindTrackEvents(streamRef.current, 'removeEventListener');
    streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, [bindTrackEvents]);

  // Unmount teardown. `releaseStream` is stable, so this only runs on unmount.
  useEffect(() => releaseStream, [releaseStream]);

  /** Acquires a stream. Resolves to `null` rather than throwing; the reason lands in `error`. */
  const acquireStream = useCallback(
    async (constraints: MediaStreamConstraints): Promise<MediaStream | null> => {
      setError(null);

      // Guarded here, not per-caller: `start` and `getMediaDevices` both route through this.
      if (!isSupported) {
        setGetStreamRequest(REQUEST_STATES.REJECTED);
        setError(new Error('getUserMedia is not supported in this browser'));
        return null;
      }

      setGetStreamRequest(REQUEST_STATES.PENDING);

      try {
        const userMediaStream: MediaStream = await navigator.mediaDevices.getUserMedia(constraints);

        bindTrackEvents(userMediaStream, 'addEventListener');
        streamRef.current = userMediaStream;
        acquiredWith.current = constraints;
        setStream(userMediaStream);
        setGetStreamRequest(REQUEST_STATES.FULFILLED);
        return userMediaStream;
      } catch (e: unknown) {
        setGetStreamRequest(REQUEST_STATES.REJECTED);
        setError(toError(e));
        return null;
      }
    },
    [isSupported, bindTrackEvents],
  );

  /**
   * Single-flight gate. Without it, a `start()` and a `getMediaDevices()` in the same tick each
   * open a stream and the first is left running with nothing able to stop it.
   *
   * Not async, so the pending promise is registered before any caller can await. Keyed on the
   * constraints so a request for one device can never be handed another's stream.
   */
  const initiateStream = useCallback(
    (constraints = mediaDeviceConstraints): Promise<MediaStream | null> => {
      const pending = inFlight.current;
      if (pending && pending.constraints === constraints) return pending.promise;

      const promise = acquireStream(constraints).finally(() => {
        if (inFlight.current?.promise === promise) inFlight.current = null;
      });

      inFlight.current = { constraints, promise };
      return promise;
    },
    [mediaDeviceConstraints, acquireStream],
  );

  /** Starts the media stream if not already streaming. */
  const start = useCallback(async (): Promise<MediaStream | null> => {
    if (isStreaming) return streamRef.current;

    // An open stream is reused, so getMediaDevices() then start() does not acquire twice — but only
    // if it matches the current constraints, or a stream opened just to read device labels would
    // silently become the one you keep.
    if (streamRef.current && acquiredWith.current !== mediaDeviceConstraints) {
      releaseStream();
      setStream(null);
    }

    const mediaStream = streamRef.current ?? (await initiateStream());

    // Set here rather than in acquireStream, which getMediaDevices also uses: only an explicit
    // start() means the consumer asked to stream.
    if (mediaStream) setIsStreaming(true);

    return mediaStream;
  }, [isStreaming, initiateStream, mediaDeviceConstraints, releaseStream]);

  /**
   * Releases the media stream and resets stream-related state.
   *
   * Guards on the stream, not `isStreaming`: `getMediaDevices` acquires one without setting that
   * flag, so keying off it left those tracks unreleasable.
   */
  const stop = useCallback((): void => {
    if (!streamRef.current) return;

    releaseStream(); // owns the ref
    setStream(null);
    setIsStreaming(false);
    setGetStreamRequest(REQUEST_STATES.IDLE);
    setError(null);
  }, [releaseStream]);

  /**
   * Lists available media devices. Acquires a stream first because labels stay blank until
   * permission is granted — https://stackoverflow.com/a/65366422/12383316 — and `stop()` releases
   * that stream like any other.
   */
  const getMediaDevices = useCallback(async (): Promise<MediaDeviceInfo[]> => {
    setError(null);
    setGetMediaDevicesRequest(REQUEST_STATES.PENDING);

    try {
      // initiateStream owns the isSupported check and populates `error` if it fails
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
      setError(toError(e));
      return [];
    }
  }, [initiateStream]);

  /** Merges new constraints over the current ones, optionally re-acquiring the stream with them. */
  const updateMediaDeviceConstraints = useCallback(
    async ({ constraints, resetStream = false }: UpdateMediaDeviceConstraintsOptions): Promise<void> => {
      const updatedUserMediaConstraints = mergeConstraints(mediaDeviceConstraints, constraints);
      setMediaDeviceConstraints(updatedUserMediaConstraints);

      // Nothing to reset with no stream open, and acquiring here would switch the camera on unasked.
      if (!resetStream || !streamRef.current) return;

      // Constraints passed explicitly: the state update above has not flushed yet.
      const wasStreaming = isStreaming;
      stop();
      const updatedStream = await initiateStream(updatedUserMediaConstraints);
      setIsStreaming(wasStreaming && !!updatedStream);
    },
    [mediaDeviceConstraints, isStreaming, stop, initiateStream],
  );

  /** Toggles `track.enabled`, which keeps the device open but stops it producing data. */
  const setTracksEnabled = useCallback((kind: TrackKind, enabled: boolean): void => {
    // Bail before touching the flag, or it contradicts the tracks once one is acquired.
    if (!streamRef.current) return;

    tracksOf(streamRef.current, kind).forEach((track) => (track.enabled = enabled));
    (kind === 'audio' ? setIsAudioMuted : setIsVideoMuted)(!enabled);
  }, []);

  const muteAudio = useCallback((): void => setTracksEnabled('audio', false), [setTracksEnabled]);
  const unmuteAudio = useCallback((): void => setTracksEnabled('audio', true), [setTracksEnabled]);
  const muteVideo = useCallback((): void => setTracksEnabled('video', false), [setTracksEnabled]);
  const unmuteVideo = useCallback((): void => setTracksEnabled('video', true), [setTracksEnabled]);

  /**
   * Consumer-supplied track listeners, applying to the tracks held right now — so they need
   * re-adding after anything that replaces the stream. Built once; they read only `streamRef`.
   */
  const trackEventListeners = useMemo(() => {
    const bind =
      (kind: TrackKind, event: TrackEvent, action: 'addEventListener' | 'removeEventListener') =>
      (fn: EventListenerOrEventListenerObject): void =>
        tracksOf(streamRef.current, kind).forEach((track) => track[action](event, fn));

    return {
      addVideoEndedEventListener: bind('video', 'ended', 'addEventListener'),
      addAudioEndedEventListener: bind('audio', 'ended', 'addEventListener'),
      addVideoMuteEventListener: bind('video', 'mute', 'addEventListener'),
      addAudioMuteEventListener: bind('audio', 'mute', 'addEventListener'),
      addVideoUnmuteEventListener: bind('video', 'unmute', 'addEventListener'),
      addAudioUnmuteEventListener: bind('audio', 'unmute', 'addEventListener'),
      removeVideoEndedEventListener: bind('video', 'ended', 'removeEventListener'),
      removeAudioEndedEventListener: bind('audio', 'ended', 'removeEventListener'),
      removeVideoMuteEventListener: bind('video', 'mute', 'removeEventListener'),
      removeAudioMuteEventListener: bind('audio', 'mute', 'removeEventListener'),
      removeVideoUnmuteEventListener: bind('video', 'unmute', 'removeEventListener'),
      removeAudioUnmuteEventListener: bind('audio', 'unmute', 'removeEventListener'),
    };
  }, []);

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
    ...trackEventListeners,
  };
};

/** Everything the hook returns. Derived, so it cannot drift from the implementation. */
export type UseMediaStreamReturn = ReturnType<typeof useMediaStream>;

export { REQUEST_STATES, defaultMediaDeviceConstraints } from './constants.js';
export type {
  RequestState,
  TrackEvent,
  TrackKind,
  UpdateMediaDeviceConstraintsOptions,
  UseMediaStreamProps,
} from './types.js';

export { useMediaStream };
export default useMediaStream;
