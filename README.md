
# Use Media Stream

[use-media-stream](https://www.react-fast-marquee.com)  is a powerful React hook designed to streamline the integration and management of media streams within your React applications. It offers a comprehensive set of features and options for effortless control and manipulation of media streams. It provides a convenient interface for handling media devices, initiating media streams, and controlling audio and video tracks.

## Installation

Install the hook using your preferred package manager:

```bash
npm install use-media-stream
or
yarn add use-media-stream
```

## Usage

Import the hook into your React component and leverage its capabilities to manage your media streams:

```jsx
import useMediaStream from 'use-media-stream';

function MyComponent() {
  const {
    stream,
    isSupported,
    isStreaming,
    isAudioMuted,
    isVideoMuted,
    // ... other properties and handlers
  } = useMediaStream();

  // ... your component logic
}
```


## Return Values

| Property                     | Type                                   | Description                                                                                                                          |
| ---------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `stream`                     | `MediaStream | null`                 | The current media stream object.                                                                                                     |
| `isStreaming`                | `boolean`                             | Indicates whether the media stream is currently active.                                                                             |
| `isAudioMuted`               | `boolean`                             | Indicates whether audio tracks are muted.                                                                                           |
| `isVideoMuted`               | `boolean`                             | Indicates whether video tracks are muted.                                                                                           |
| `devices`                    | `MediaDeviceInfo[]`                   | An array of available media devices.                                                                                                |
| `audioInputDevices`          | `MediaDeviceInfo[]`                   | An array of available audio input devices.                                                                                         |
| `audioOutputDevices`         | `MediaDeviceInfo[]`                   | An array of available audio output devices.                                                                                        |
| `videoInputDevices`          | `MediaDeviceInfo[]`                   | An array of available video input devices.                                                                                         |
| `getStreamRequest`           | `REQUEST_STATES`                      | The state of the request to obtain the media stream (`IDLE`, `PENDING`, `FULFILLED`, or `REJECTED`).                                |
| `getMediaDevicesRequest`     | `REQUEST_STATES`                      | The state of the request to obtain media devices (`IDLE`, `PENDING`, `FULFILLED`, or `REJECTED`).                                  |
| `error`                      | `unknown`                             | Any error that occurred during media stream or device retrieval.                                                                    |
| `start`                      | `() => Promise<MediaStream | null>`   | Initiates the media stream if not already streaming.                                                                                |
| `stop`                       | `() => void`                          | Stops the media stream if currently streaming.                                                                                      |
| `getMediaDevices`            | `() => Promise<MediaDeviceInfo[]>`    | Retrieves a list of available media devices.                                                                                       |
| `updateMediaDeviceConstraints`| `({ constraints, resetStream }) => Promise<void>` | Updates media device constraints and optionally resets the media stream.                                                          |
| `muteAudio`                  | `() => void`                          | Mutes all audio tracks in the media stream.                                                                                        |
| `unmuteAudio`                | `() => void`                          | Unmutes all audio tracks in the media stream.                                                                                     |
| `muteVideo`                  | `() => void`                          | Mutes all video tracks in the media stream.                                                                                        |
| `unmuteVideo`                | `() => void`                          | Unmutes all video tracks in the media stream.                                                                                     |
| `addVideoEndedEventListener` | `(fn: EventListenerOrEventListenerObject) => void` | Adds an event listener for 'ended' events on video tracks.                                                                     |
| `addAudioEndedEventListener` | `(fn: EventListenerOrEventListenerObject) => void` | Adds an event listener for 'ended' events on audio tracks.                                                                     |
| `addVideoMuteEventListener`  | `(fn: EventListenerOrEventListenerObject) => void` | Adds an event listener for 'mute' events on video tracks.                                                                     |
| `addAudioMuteEventListener`  | `(fn: EventListenerOrEventListenerObject) => void` | Adds an event listener for 'mute' events on audio tracks.                                                                     |
| `removeVideoEndedEventListener` | `(fn: EventListenerOrEventListenerObject) => void` | Removes an event listener for 'ended' events on video tracks.                                                                |
| `removeAudioEndedEventListener` | `(fn: EventListenerOrEventListenerObject) => void` | Removes an event listener for 'ended' events on audio tracks.                                                                |
| `removeVideoMuteEventListener`  | `(fn: EventListenerOrEventListenerObject) => void` | Removes an event listener for 'mute' events on video tracks.                                                                |
| `removeAudioMuteEventListener`  | `(fn: EventListenerOrEventListenerObject) => void` | Removes an event listener for 'mute' events on audio tracks.                                                                |


## Example

TODO:
<!-- For a detailed example of usage, refer to the provided example in the example directory. -->

## License

This project is licensed under the MIT License - see the LICENSE.md file for details.

## Acknowledgments

Feel free to use and contribute! If you encounter any issues or have suggestions, please [open an issue](https://github.com/kothariji/use-media-stream/issues).

