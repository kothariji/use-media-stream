// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useMediaStream from '../src/index.js';

/**
 * A minimal fake for the bits of the media API this hook touches. `stop` is a spy because
 * "did the camera actually get released" is the whole question behind the leak regressions
 * below, and a stopped track is the only observable proof of it.
 */
const makeTrack = (kind: 'audio' | 'video', deviceId = `${kind}-device`) => {
  const listeners = new Map<string, Set<EventListener>>();
  const track = {
    kind,
    enabled: true,
    readyState: 'live',
    stop: vi.fn(() => {
      track.readyState = 'ended';
    }),
    getSettings: () => ({ deviceId, width: 1280, height: 720, aspectRatio: 16 / 9 }),
    addEventListener: (type: string, fn: EventListener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: (type: string, fn: EventListener) => {
      listeners.get(type)?.delete(fn);
    },
    /** test-only: fire an event the browser would normally raise */
    emit: (type: string) => listeners.get(type)?.forEach((fn) => fn(new Event(type))),
    /** test-only: how many listeners are currently attached */
    count: (type: string) => listeners.get(type)?.size ?? 0,
  };
  return track;
};

type FakeTrack = ReturnType<typeof makeTrack>;

const makeStream = (tracks: FakeTrack[]) =>
  ({
    getTracks: () => tracks,
    getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'),
    getVideoTracks: () => tracks.filter((t) => t.kind === 'video'),
  }) as unknown as MediaStream;

const DEVICES = [
  { deviceId: 'a1', kind: 'audioinput', label: 'Mic', groupId: 'g' },
  { deviceId: 'a2', kind: 'audiooutput', label: 'Speaker', groupId: 'g' },
  { deviceId: 'v1', kind: 'videoinput', label: 'Cam', groupId: 'g' },
  { deviceId: 'v2', kind: 'videoinput', label: 'Cam 2', groupId: 'g' },
] as MediaDeviceInfo[];

let audioTrack: FakeTrack;
let videoTrack: FakeTrack;
let getUserMedia: ReturnType<typeof vi.fn>;

const setMediaDevices = (value: unknown) =>
  Object.defineProperty(navigator, 'mediaDevices', { value, configurable: true, writable: true });

beforeEach(() => {
  audioTrack = makeTrack('audio');
  videoTrack = makeTrack('video');
  getUserMedia = vi.fn(async () => makeStream([audioTrack, videoTrack]));
  setMediaDevices({ getUserMedia, enumerateDevices: vi.fn(async () => DEVICES) });
});

afterEach(() => vi.restoreAllMocks());

/** `start()` is async, so every call that touches it needs an async act. */
const mount = () => renderHook(() => useMediaStream());

describe('start / stop', () => {
  it('acquires a stream and reports it', async () => {
    const { result } = mount();
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.getStreamRequest).toBe('IDLE');

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.isStreaming).toBe(true);
    expect(result.current.stream).not.toBeNull();
    expect(result.current.getStreamRequest).toBe('FULFILLED');
    expect(result.current.error).toBeNull();
  });

  it('does not re-acquire when already streaming', async () => {
    const { result } = mount();
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.start();
    });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('stops every track and resets state', async () => {
    const { result } = mount();
    await act(async () => {
      await result.current.start();
    });
    act(() => result.current.stop());

    expect(audioTrack.stop).toHaveBeenCalledTimes(1);
    expect(videoTrack.stop).toHaveBeenCalledTimes(1);
    expect(result.current.stream).toBeNull();
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.getStreamRequest).toBe('IDLE');
  });

  it('detaches its listeners on stop, so tracks are not left referenced', async () => {
    const { result } = mount();
    await act(async () => {
      await result.current.start();
    });
    expect(videoTrack.count('ended')).toBe(1);

    act(() => result.current.stop());
    expect(videoTrack.count('ended')).toBe(0);
    expect(videoTrack.count('mute')).toBe(0);
    expect(videoTrack.count('unmute')).toBe(0);
  });

  it('is a no-op when nothing was started', () => {
    const { result } = mount();
    expect(() => act(() => result.current.stop())).not.toThrow();
    expect(videoTrack.stop).not.toHaveBeenCalled();
  });
});

describe('leak regressions', () => {
  // stop() used to guard on isStreaming, which getMediaDevices never sets — so the stream it
  // opened to read device labels stayed live with no public way to release it.
  it('releases the stream getMediaDevices opened', async () => {
    const { result } = mount();
    await act(async () => {
      await result.current.getMediaDevices();
    });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(videoTrack.stop).not.toHaveBeenCalled();

    act(() => result.current.stop());
    expect(videoTrack.stop).toHaveBeenCalledTimes(1);
    expect(audioTrack.stop).toHaveBeenCalledTimes(1);
  });

  // There was no unmount cleanup at all, so navigating away left the camera on until the tab closed.
  it('releases the stream when the component unmounts', async () => {
    const { result, unmount } = mount();
    await act(async () => {
      await result.current.start();
    });
    expect(videoTrack.stop).not.toHaveBeenCalled();

    unmount();
    expect(videoTrack.stop).toHaveBeenCalledTimes(1);
    expect(audioTrack.stop).toHaveBeenCalledTimes(1);
  });

  it('unmounts cleanly when no stream was ever acquired', () => {
    const { unmount } = mount();
    expect(() => unmount()).not.toThrow();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('releases on unmount even when only getMediaDevices ran', async () => {
    const { result, unmount } = mount();
    await act(async () => {
      await result.current.getMediaDevices();
    });
    unmount();
    expect(videoTrack.stop).toHaveBeenCalledTimes(1);
  });
});

describe('failure paths', () => {
  it('reports an unsupported browser instead of throwing', async () => {
    setMediaDevices(undefined);
    const { result } = mount();
    expect(result.current.isSupported).toBe(false);

    let returned: MediaStream | null = null;
    await act(async () => {
      returned = await result.current.start();
    });

    expect(returned).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toMatch(/not supported/i);
    expect(result.current.getStreamRequest).toBe('REJECTED');
  });

  it('coerces a non-Error rejection into an Error', async () => {
    // getUserMedia rejects with a DOMException in practice, but nothing guarantees it
    getUserMedia.mockRejectedValueOnce('camera on fire');
    const { result } = mount();

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('camera on fire');
  });

  it('rejects getMediaDevices when the stream it needs cannot be acquired', async () => {
    setMediaDevices(undefined);
    const { result } = mount();

    let devices: MediaDeviceInfo[] = [];
    await act(async () => {
      devices = await result.current.getMediaDevices();
    });

    expect(devices).toEqual([]);
    expect(result.current.getMediaDevicesRequest).toBe('REJECTED');
    expect(result.current.error?.message).toMatch(/not supported/i);
  });

  it('captures a rejected enumerateDevices', async () => {
    setMediaDevices({
      getUserMedia,
      enumerateDevices: vi.fn(async () => {
        throw new Error('enumeration failed');
      }),
    });
    const { result } = mount();

    let devices: MediaDeviceInfo[] = [];
    await act(async () => {
      devices = await result.current.getMediaDevices();
    });

    expect(devices).toEqual([]);
    expect(result.current.getMediaDevicesRequest).toBe('REJECTED');
    expect(result.current.error?.message).toBe('enumeration failed');
  });

  it('captures a rejected getUserMedia', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'));
    const { result } = mount();

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.stream).toBeNull();
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.getStreamRequest).toBe('REJECTED');
    expect(result.current.error?.message).toBe('Permission denied');
  });
});

describe('devices', () => {
  it('splits devices by kind and exposes the selected track settings', async () => {
    const { result } = mount();
    await act(async () => {
      await result.current.getMediaDevices();
    });

    expect(result.current.devices).toHaveLength(4);
    expect(result.current.audioInputDevices.map((d) => d.deviceId)).toEqual(['a1']);
    expect(result.current.audioOutputDevices.map((d) => d.deviceId)).toEqual(['a2']);
    expect(result.current.videoInputDevices.map((d) => d.deviceId)).toEqual(['v1', 'v2']);
    expect(result.current.getMediaDevicesRequest).toBe('FULFILLED');

    expect(result.current.selectedVideoTrackDeviceId).toBe('video-device');
    expect(result.current.selectedVideoTrackDeviceWidth).toBe(1280);
  });

  it('does not switch the camera on when resetting with no stream open', async () => {
    const { result } = mount();
    await act(async () => {
      await result.current.updateMediaDeviceConstraints({ constraints: { video: { width: 640 } }, resetStream: true });
    });

    expect(getUserMedia).not.toHaveBeenCalled();

    // the constraints are still recorded, and apply to the next stream
    await act(async () => {
      await result.current.start();
    });
    expect(getUserMedia.mock.calls[0][0]).toMatchObject({ video: { width: 640, facingMode: 'user' } });
  });

  it('re-acquires with merged constraints when asked to reset', async () => {
    const { result } = mount();
    await act(async () => {
      await result.current.start();
    });

    await act(async () => {
      await result.current.updateMediaDeviceConstraints({ constraints: { video: { width: 640 } }, resetStream: true });
    });

    expect(videoTrack.stop).toHaveBeenCalledTimes(1); // old stream released
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    // width overridden, but the default facingMode survives the merge
    expect(getUserMedia.mock.calls[1][0]).toMatchObject({ video: { width: 640, facingMode: 'user' } });
    expect(result.current.isStreaming).toBe(true);
  });
});

describe('mute', () => {
  it('toggles track.enabled without stopping the track', async () => {
    const { result } = mount();
    await act(async () => {
      await result.current.start();
    });

    act(() => result.current.muteAudio());
    expect(audioTrack.enabled).toBe(false);
    expect(result.current.isAudioMuted).toBe(true);
    expect(audioTrack.stop).not.toHaveBeenCalled();

    act(() => result.current.unmuteAudio());
    expect(audioTrack.enabled).toBe(true);
    expect(result.current.isAudioMuted).toBe(false);

    act(() => result.current.muteVideo());
    expect(videoTrack.enabled).toBe(false);
    expect(result.current.isVideoMuted).toBe(true);
  });

  it('does not claim a track is muted when there is no stream', () => {
    const { result } = mount();
    act(() => result.current.muteAudio());
    act(() => result.current.muteVideo());

    expect(result.current.isAudioMuted).toBe(false);
    expect(result.current.isVideoMuted).toBe(false);
  });

  // the mute flags used to be one-way: nothing listened for 'unmute'
  it('follows the track back out of a mute', async () => {
    const { result } = mount();
    await act(async () => {
      await result.current.start();
    });

    act(() => videoTrack.emit('mute'));
    expect(result.current.isVideoMuted).toBe(true);

    act(() => videoTrack.emit('unmute'));
    expect(result.current.isVideoMuted).toBe(false);
  });

  it('tracks mute and unmute on audio as well as video', async () => {
    const { result } = mount();
    await act(async () => {
      await result.current.start();
    });

    act(() => audioTrack.emit('mute'));
    expect(result.current.isAudioMuted).toBe(true);
    expect(result.current.isVideoMuted).toBe(false); // independent of video

    act(() => audioTrack.emit('unmute'));
    expect(result.current.isAudioMuted).toBe(false);
  });

  it('marks the stream as no longer streaming when a track ends on its own', async () => {
    const { result } = mount();
    await act(async () => {
      await result.current.start();
    });

    act(() => videoTrack.emit('ended'));
    expect(result.current.isStreaming).toBe(false);
  });
});

describe('referential stability', () => {
  // A fresh array each render makes `useEffect(..., [audioInputDevices])` re-run forever.
  it('keeps the device arrays stable across re-renders', async () => {
    const { result, rerender } = mount();
    await act(async () => {
      await result.current.getMediaDevices();
    });

    const before = result.current.audioInputDevices;
    rerender();
    expect(result.current.audioInputDevices).toBe(before);
    expect(result.current.videoInputDevices).toBe(result.current.videoInputDevices);
  });

  it('keeps the device arrays stable when unrelated state changes', async () => {
    const { result } = mount();
    await act(async () => {
      await result.current.getMediaDevices();
    });

    const before = result.current.videoInputDevices;
    act(() => result.current.muteAudio()); // flips isAudioMuted, nothing to do with devices
    expect(result.current.videoInputDevices).toBe(before);
  });

  it('keeps the mute and listener handlers stable across re-renders', async () => {
    const { result, rerender } = mount();
    const before = {
      muteAudio: result.current.muteAudio,
      unmuteVideo: result.current.unmuteVideo,
      addVideoEndedEventListener: result.current.addVideoEndedEventListener,
      removeAudioMuteEventListener: result.current.removeAudioMuteEventListener,
    };

    rerender();
    await act(async () => {
      await result.current.start();
    });

    expect(result.current.muteAudio).toBe(before.muteAudio);
    expect(result.current.unmuteVideo).toBe(before.unmuteVideo);
    expect(result.current.addVideoEndedEventListener).toBe(before.addVideoEndedEventListener);
    expect(result.current.removeAudioMuteEventListener).toBe(before.removeAudioMuteEventListener);
  });

  it('keeps stop stable across re-renders', () => {
    const { result, rerender } = mount();
    const before = result.current.stop;
    rerender();
    expect(result.current.stop).toBe(before);
  });
});

describe('consumer event listeners', () => {
  it('adds and removes listeners on the live tracks', async () => {
    const { result } = mount();
    await act(async () => {
      await result.current.start();
    });

    const onEnded = vi.fn();
    act(() => result.current.addVideoEndedEventListener(onEnded));
    act(() => videoTrack.emit('ended'));
    expect(onEnded).toHaveBeenCalledTimes(1);

    act(() => result.current.removeVideoEndedEventListener(onEnded));
    act(() => videoTrack.emit('ended'));
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when there is no stream to attach to', () => {
    const { result } = mount();
    const noop: EventListener = () => {};
    expect(() => act(() => result.current.addVideoEndedEventListener(noop))).not.toThrow();
    expect(() => act(() => result.current.removeAudioMuteEventListener(noop))).not.toThrow();
  });

  it('exposes unmute listeners, matching the mute ones', async () => {
    const { result } = mount();
    await act(async () => {
      await result.current.start();
    });

    const onUnmute = vi.fn();
    act(() => result.current.addAudioUnmuteEventListener(onUnmute));
    act(() => audioTrack.emit('unmute'));
    expect(onUnmute).toHaveBeenCalledTimes(1);

    act(() => result.current.removeAudioUnmuteEventListener(onUnmute));
    act(() => audioTrack.emit('unmute'));
    expect(onUnmute).toHaveBeenCalledTimes(1);
  });
});
