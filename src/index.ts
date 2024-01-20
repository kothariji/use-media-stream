import { useCallback, useRef, useState } from 'react';
import { REQUEST_STATES } from './constants';
import merge from 'deepmerge';

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

/**
 * React hook for managing and integrating media streams within your application.
 */
const useMediaStream = (props?: useMediaStreamInterface) => {
  // check if the browser supports `getUserMedia`
  const isSupported = !!navigator?.mediaDevices?.getUserMedia;
  const [mediaDeviceConstraints, setMediaDeviceConstraints] = useState(() =>
    merge(defaultMediaDeviceConstraints, props?.mediaDeviceConstraints ?? {}),
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

  const stream = useRef<MediaStream | null>(null);

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

  const selectedAudioDeviceTrack = stream.current?.getAudioTracks()[0];
  const selectedVideoDeviceTrack = stream.current?.getVideoTracks()[0];
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

  const handleOnVideoOrAudioEndedEvent = useCallback(() => {
    setIsStreaming(false);
  }, []);

  /**
   * Initiates a media stream based on the provided constraints or default constraints.
   *
   * @async
   * @function initiateStream
   * @param {MediaStreamConstraints} [mediaDeviceConstraintsFromArgs=defaultMediaDeviceConstraints]
   *        - Constraints for the media device, taken from arguments or defaults to the global defaults.
   * @returns {Promise<MediaStream>} A promise resolving to the obtained media stream.
   */
  const initiateStream = async (
    mediaDeviceConstraintsFromArgs = mediaDeviceConstraints,
  ): Promise<MediaStream | null> => {
    // resetting the error state
    setError(null);
    setGetStreamRequest(REQUEST_STATES.PENDING);

    try {
      const userMediaStream: MediaStream = await navigator.mediaDevices.getUserMedia(mediaDeviceConstraintsFromArgs);

      //adding default onended and onmute listeners to video tracks in case the stream end accidentally
      userMediaStream.getVideoTracks().map((track) => {
        track.addEventListener('ended', handleOnVideoOrAudioEndedEvent);
        track.addEventListener('mute', handleOnVideoMuteEvent);
      });

      //adding default onended and onmute listeners to audio tracks in case the stream end accidentally
      userMediaStream.getAudioTracks().map((track) => {
        track.addEventListener('ended', handleOnVideoOrAudioEndedEvent);
        track.addEventListener('mute', handleOnAudioMuteEvent);
      });

      stream.current = userMediaStream;
      setGetStreamRequest(REQUEST_STATES.FULFILLED);

      // returns a media stream
      return userMediaStream;
    } catch (e: unknown) {
      setGetStreamRequest(REQUEST_STATES.REJECTED);

      // populate error in case the stream is not fetched
      setError(e);
      return null;
    }
  };

  /**
   * Starts the media stream if not already streaming and returns the obtained media stream.
   *
   * @async
   * @function start
   * @returns {Promise<MediaStream | null>} A promise resolving to the started media stream.
   */
  const start = async (): Promise<MediaStream | null> => {
    if (isStreaming) return stream.current;

    let mediaStream = stream.current || null;

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
   * stops the media stream if not already streaming and returns the obtained media stream.
   *
   * @function stop
   * @returns void
   */
  const stop = (): void => {
    if (!isStreaming) return;

    const userMediaStream = stream.current;

    if (!userMediaStream) return;

    //removing default eventListeners added in `initiateStream`
    userMediaStream.getVideoTracks().map((track) => {
      track.removeEventListener('ended', handleOnVideoOrAudioEndedEvent);
      track.removeEventListener('mute', handleOnVideoMuteEvent);
    });

    //adding default onended and onmute listeners to audio tracks in case the stream end accidentally
    userMediaStream.getAudioTracks().map((track) => {
      track.removeEventListener('ended', handleOnVideoOrAudioEndedEvent);
      track.removeEventListener('mute', handleOnAudioMuteEvent);
    });

    userMediaStream.getTracks().forEach((track) => track.stop());

    // resetting the states
    stream.current = null;
    setIsStreaming(false);
    setGetStreamRequest(REQUEST_STATES.IDLE);
    setError(null);
  };

  /**
   * Retrieves a list of available media devices.
   * PS: This function internally initiates the media stream by calling `initiateStream` This is required to fetch devices, Read more here - https://stackoverflow.com/a/65366422/12383316
   *
   * @async
   * @function getMediaDevices
   * @throws {Error} If there is an error while obtaining the media devices or initiating the media stream.
   * @returns {Promise<MediaDeviceInfo[]>} A promise resolving to an array of available media devices.
   */
  const getMediaDevices = async (): Promise<MediaDeviceInfo[]> => {
    if (!isSupported) {
      setGetMediaDevicesRequest(REQUEST_STATES.REJECTED);
      const browserNotSupportedError = new Error('getUserMedia is not supported in this browser');
      setError(browserNotSupportedError);
      return [];
    }

    setError(null);
    setGetMediaDevicesRequest(REQUEST_STATES.PENDING);

    try {
      if (!stream.current) {
        await initiateStream();
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

  /**
   * Updates the media device constraints and optionally resets the media stream with the new constraints.
   *
   * @async
   * @function updateMediaDeviceConstraints
   * @param {Object} options - Options for updating the media device constraints.
   * @param {MediaStreamConstraints} options.constraints - New constraints to be merged with existing ones.
   * @param {boolean} options.resetStream - Whether to reset the media stream with the updated constraints.
   * @returns {Promise<void>} A promise resolving after updating the constraints and, if requested, resetting the stream.
   */
  const updateMediaDeviceConstraints = async ({
    constraints,
    resetStream = false,
  }: {
    constraints: MediaStreamConstraints;
    resetStream: boolean;
  }) => {
    const updatedUserMediaConstraints = merge(mediaDeviceConstraints, constraints);
    setMediaDeviceConstraints(updatedUserMediaConstraints);

    const isAlreadyStreaming = isStreaming;
    if (resetStream) {
      setIsStreaming(false);
      stop();
      await initiateStream(updatedUserMediaConstraints);
      setIsStreaming(isAlreadyStreaming);
    }
  };

  /**
   * Mute all audio tracks in the streams
   *
   * @function muteAudio
   */
  const muteAudio = (): void => {
    if (!stream.current) {
      return;
    }
    stream.current.getAudioTracks().forEach((t) => (t.enabled = false));
    setIsAudioMuted(true);
  };

  /**
   * Unmute all audio tracks in the streams
   *
   * @function unmuteAudio
   */
  const unmuteAudio = (): void => {
    if (!stream.current) {
      return;
    }
    stream.current.getAudioTracks().forEach((t) => (t.enabled = true));
    setIsAudioMuted(false);
  };

  /**
   * Mute all video tracks in the streams
   *
   * @function muteVideo
   */
  const muteVideo = (): void => {
    if (!stream.current) {
      return;
    }
    stream.current.getVideoTracks().forEach((t) => (t.enabled = false));
    setIsVideoMuted(true);
  };

  /**
   * Unmute all audio tracks in the streams
   *
   * @function unmuteVideo
   */
  const unmuteVideo = (): void => {
    if (!stream.current) {
      return;
    }
    stream.current.getVideoTracks().forEach((t) => (t.enabled = true));
    setIsVideoMuted(false);
  };

  // add event listeners on 'ended' and 'mute' events

  const addVideoEndedEventListener = (fn: EventListenerOrEventListenerObject) => {
    stream.current?.getVideoTracks().map((track) => {
      track.addEventListener('ended', fn);
    });
  };

  const addAudioEndedEventListener = (fn: EventListenerOrEventListenerObject) => {
    stream.current?.getAudioTracks().map((track) => {
      track.addEventListener('ended', fn);
    });
  };

  const addVideoMuteEventListener = (fn: EventListenerOrEventListenerObject) => {
    stream.current?.getVideoTracks().map((track) => {
      track.addEventListener('mute', fn);
    });
  };

  const addAudioMuteEventListener = (fn: EventListenerOrEventListenerObject) => {
    stream.current?.getAudioTracks().map((track) => {
      track.addEventListener('mute', fn);
    });
  };

  // remove existing event listeners on 'ended' and 'mute' events

  const removeVideoEndedEventListener = (fn: EventListenerOrEventListenerObject) => {
    stream.current?.getVideoTracks().map((track) => {
      track.removeEventListener('ended', fn);
    });
  };

  const removeAudioEndedEventListener = (fn: EventListenerOrEventListenerObject) => {
    stream.current?.getAudioTracks().map((track) => {
      track.removeEventListener('ended', fn);
    });
  };

  const removeVideoMuteEventListener = (fn: EventListenerOrEventListenerObject) => {
    stream.current?.getVideoTracks().map((track) => {
      track.removeEventListener('mute', fn);
    });
  };

  const removeAudioMuteEventListener = (fn: EventListenerOrEventListenerObject) => {
    stream.current?.getAudioTracks().map((track) => {
      track.removeEventListener('mute', fn);
    });
  };

  return {
    stream: stream.current,
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
