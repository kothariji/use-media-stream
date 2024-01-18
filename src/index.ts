import { useRef, useState } from 'react';
import { REQUEST_STATES } from './constants';
const merge = require('deepmerge');

const GET_USER_MEDIA_ERRORS = {
  NotAllowedError: 'NotAllowedError',
  NotFoundError: 'NotFoundError',
  NotReadableError: 'NotReadableError',
  OverconstrainedError: 'OverconstrainedError',
};

const GET_USER_MEDIA_ERROR_MESSAGES = {
  [GET_USER_MEDIA_ERRORS.NotAllowedError]: `Click on the lock icon in your browser's address bar and allow permissions for camera and microphone`,
  [GET_USER_MEDIA_ERRORS.NotFoundError]: 'The requested media track or device was not found',
  [GET_USER_MEDIA_ERRORS.NotReadableError]: 'The media track or device is not readable',
  [GET_USER_MEDIA_ERRORS.OverconstrainedError]: 'The media tracks requested are conflicting and cannot be satisfied',
};

interface useMediaStreamInterface {
  mediaDeviceConstraints: MediaStreamConstraints | null;
}

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

// TODO: add removeEventListeners on unmount
// TODO: add global error
const useMediaStream = ({ mediaDeviceConstraints: _mediaDeviceConstraints }: useMediaStreamInterface) => {
  const isSupported = !!navigator?.mediaDevices?.getUserMedia;
  const [mediaDeviceConstraints, setMediaDeviceConstraints] = useState(() =>
    merge(defaultMediaDeviceConstraints, _mediaDeviceConstraints),
  );
  const [getStreamRequest, setGetStreamRequest] = useState(REQUEST_STATES.IDLE);
  const [getMediaDevicesRequest, setGetMediaDevicesRequest] = useState(REQUEST_STATES.IDLE);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
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

  const initiateStream = async (mediaDeviceConstraintsFromArgs = mediaDeviceConstraints) => {
    setGetStreamRequest(REQUEST_STATES.PENDING);

    try {
      const userMediaStream = await navigator.mediaDevices.getUserMedia(mediaDeviceConstraintsFromArgs);

      //adding default onended and onmute listeners to stream
      userMediaStream.getVideoTracks().map((track) => {
        track.addEventListener('ended', () => {
          setIsStreaming(false);
        });
        track.addEventListener('mute', () => {
          setIsVideoMuted(true);
        });
      });

      userMediaStream.getAudioTracks().map((track) => {
        track.addEventListener('ended', () => {
          setIsStreaming(false);
        });
        track.addEventListener('mute', () => {
          setIsAudioMuted(true);
        });
      });

      stream.current = userMediaStream;
      setGetStreamRequest(REQUEST_STATES.FULFILLED);
      return userMediaStream;
    } catch (e: any) {
      if (e.name in GET_USER_MEDIA_ERRORS) {
        e.errorMessage = GET_USER_MEDIA_ERROR_MESSAGES[e.name];
      }
      setGetStreamRequest(REQUEST_STATES.REJECTED);
      //TODO: capture error
      //   getStreamRequestHandlers.rejected(e);
      throw e;
    }
  };

  const start = async () => {
    if (isStreaming) return;

    const mediaStream = await initiateStream();

    // setting setIsStreaming here, to explicity tell user, that start function is called.
    // setting this inside initiateStream will create confusion, as initiateStream is called by other fns like getMediaDevices
    setIsStreaming(true);
    return mediaStream;
  };

  const stop = () => {
    if (!isStreaming) return;

    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setIsStreaming(false);

    setGetStreamRequest(REQUEST_STATES.IDLE);
  };

  const getMediaDevices = async () => {
    setGetMediaDevicesRequest(REQUEST_STATES.PENDING);
    if (!isSupported) {
      setGetMediaDevicesRequest(REQUEST_STATES.REJECTED);
      return [];
    }
    try {
      if (!stream.current) {
        await initiateStream();
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      setDevices(devices);
      setGetMediaDevicesRequest(REQUEST_STATES.FULFILLED);
      return devices;
    } catch (e) {
      setGetMediaDevicesRequest(REQUEST_STATES.REJECTED);
      //   getMediaDevicesHandlers.rejected(e);
      // TODO: handle error
      return [];
    }
  };

  const updateMediaDeviceConstraints = async ({
    constraints,
    resetStream = false,
  }: {
    constraints: MediaStreamConstraints;
    resetStream: boolean;
  }) => {
    const updatedUserMediaConstraints = merge(mediaDeviceConstraints, constraints);
    setMediaDeviceConstraints(updatedUserMediaConstraints);
    if (resetStream) {
      stop();
      await initiateStream(updatedUserMediaConstraints);
      setIsStreaming(true);
    }
  };

  const muteAudio = () => {
    if (!isStreaming) {
      return;
    }
    stream.current?.getAudioTracks().forEach((t) => (t.enabled = false));
    setIsAudioMuted(true);
  };

  const unmuteAudio = () => {
    if (!isStreaming) {
      return;
    }
    stream.current?.getAudioTracks().forEach((t) => (t.enabled = true));
    setIsAudioMuted(false);
  };

  const muteVideo = () => {
    if (!isStreaming) {
      return;
    }
    stream.current?.getVideoTracks().forEach((t) => (t.enabled = false));
    setIsVideoMuted(true);
  };

  const unmuteVideo = () => {
    if (!isStreaming) {
      return;
    }
    stream.current?.getVideoTracks().forEach((t) => (t.enabled = true));
    setIsVideoMuted(false);
  };

  // isStreaming should be false in such cases
  const addVideoEndedEventListener = (fn: EventListenerOrEventListenerObject) => {
    stream.current?.getVideoTracks()?.map((track) => {
      track.addEventListener('ended', fn);
    });
  };

  const addAudioEndedEventListener = (fn: EventListenerOrEventListenerObject) => {
    stream.current?.getAudioTracks()?.map((track) => {
      track.addEventListener('ended', fn);
    });
  };

  const addVideoMuteEventListener = (fn: EventListenerOrEventListenerObject) => {
    stream.current?.getVideoTracks()?.map((track) => {
      track.addEventListener('mute', fn);
    });
  };

  const addAudioMuteEventListener = (fn: EventListenerOrEventListenerObject) => {
    stream.current?.getAudioTracks()?.map((track) => {
      track.addEventListener('mute', fn);
    });
  };

  const removeVideoEndedEventListener = (fn: EventListenerOrEventListenerObject) => {
    stream.current?.getVideoTracks()?.map((track) => {
      track.removeEventListener('ended', fn);
    });
  };

  const removeAudioEndedEventListener = (fn: EventListenerOrEventListenerObject) => {
    stream.current?.getAudioTracks()?.map((track) => {
      track.removeEventListener('ended', fn);
    });
  };

  const removeVideoMuteEventListener = (fn: EventListenerOrEventListenerObject) => {
    stream.current?.getVideoTracks()?.map((track) => {
      track.removeEventListener('mute', fn);
    });
  };

  const removeAudioMuteEventListener = (fn: EventListenerOrEventListenerObject) => {
    stream.current?.getAudioTracks()?.map((track) => {
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
