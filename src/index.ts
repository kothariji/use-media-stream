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

/**
 * React hook for managing and integrating media streams within your application.
 */
const useMediaStream = (props?: UseMediaStreamProps) => {
  // check if the browser supports `getUserMedia`
  const isSupported = !!navigator?.mediaDevices?.getUserMedia;
  const [mediaDeviceConstraints, setMediaDeviceConstraints] = useState(() =>
    mergeConstraints(defaultMediaDeviceConstraints, props?.mediaDeviceConstraints ?? {}),
  );
  // Annotated, otherwise `as const` on REQUEST_STATES narrows these to the literal 'IDLE'.
  const [getStreamRequest, setGetStreamRequest] = useState<RequestState>(REQUEST_STATES.IDLE);
  const [getMediaDevicesRequest, setGetMediaDevicesRequest] = useState<RequestState>(REQUEST_STATES.IDLE);

  // `isStreaming` is a flag that holds true when the start() function is called.
  const [isStreaming, setIsStreaming] = useState(false);

  //global state for capturing any error in while fetching the stream or devices
  const [error, setError] = useState<Error | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  // State drives re-renders of the derived values below; the ref mirror is what teardown
  // reads, since it must see the live stream rather than the last committed render.
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Memoised on identity, not just cost: a fresh array each render makes any consumer with
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
  const initiateStream = useCallback(
    async (mediaDeviceConstraintsFromArgs = mediaDeviceConstraints): Promise<MediaStream | null> => {
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
        setError(toError(e));
        return null;
      }
    },
    [mediaDeviceConstraints, isSupported, bindTrackEvents],
  );

  /** Starts the media stream if not already streaming. */
  const start = useCallback(async (): Promise<MediaStream | null> => {
    if (isStreaming) return streamRef.current;

    const mediaStream = streamRef.current ?? (await initiateStream());

    if (mediaStream) {
      /**
       * Set `isStreaming` explicitly here rather than in `initiateStream`, which other callers
       * like `getMediaDevices` also use — only an explicit start() means the consumer asked for it.
       */
      setIsStreaming(true);
    }

    return mediaStream;
  }, [isStreaming, initiateStream]);

  /**
   * Releases the media stream and resets stream-related state.
   *
   * Guards on the stream, not `isStreaming`: `getMediaDevices` acquires a stream without ever
   * setting that flag, so keying off it left those tracks running with no way to release them.
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
   * Lists available media devices, acquiring a stream first because device labels stay blank
   * until permission is granted — see https://stackoverflow.com/a/65366422/12383316
   *
   * The stream it opens is released by `stop()` like any other.
   */
  const getMediaDevices = useCallback(async (): Promise<MediaDeviceInfo[]> => {
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
      setError(toError(e));
      return [];
    }
  }, [initiateStream]);

  /** Merges new constraints over the current ones, optionally re-acquiring the stream with them. */
  const updateMediaDeviceConstraints = useCallback(
    async ({ constraints, resetStream = false }: UpdateMediaDeviceConstraintsOptions): Promise<void> => {
      const updatedUserMediaConstraints = mergeConstraints(mediaDeviceConstraints, constraints);
      setMediaDeviceConstraints(updatedUserMediaConstraints);

      // Guards on the stream for the same reason `stop()` does. There is nothing to reset when no
      // stream is open, and re-acquiring here would switch the camera on without being asked to.
      if (!resetStream || !streamRef.current) return;

      // Constraints are passed explicitly below because the state update above has not flushed yet.
      const wasStreaming = isStreaming;
      stop();
      const updatedStream = await initiateStream(updatedUserMediaConstraints);
      setIsStreaming(wasStreaming && !!updatedStream);
    },
    [mediaDeviceConstraints, isStreaming, stop, initiateStream],
  );

  /** Toggles `track.enabled`, which keeps the device open but stops it producing data. */
  const setTracksEnabled = useCallback((kind: TrackKind, enabled: boolean): void => {
    // Bail before touching the flag: with no stream there is nothing to mute, and reporting
    // otherwise leaves the flag contradicting the tracks once one is acquired.
    if (!streamRef.current) return;

    tracksOf(streamRef.current, kind).forEach((track) => (track.enabled = enabled));
    (kind === 'audio' ? setIsAudioMuted : setIsVideoMuted)(!enabled);
  }, []);

  const muteAudio = useCallback((): void => setTracksEnabled('audio', false), [setTracksEnabled]);
  const unmuteAudio = useCallback((): void => setTracksEnabled('audio', true), [setTracksEnabled]);
  const muteVideo = useCallback((): void => setTracksEnabled('video', false), [setTracksEnabled]);
  const unmuteVideo = useCallback((): void => setTracksEnabled('video', true), [setTracksEnabled]);

  /**
   * Consumer-supplied track listeners. These apply to the tracks held right now, so they need
   * re-adding after anything that replaces the stream.
   *
   * Built once: every one of them reads `streamRef`, which never changes identity, so there is
   * nothing for them to close over stalely.
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

/**
 * Everything the hook returns.
 *
 * ponytail: derived rather than hand-written, so it cannot drift from the implementation.
 */
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
