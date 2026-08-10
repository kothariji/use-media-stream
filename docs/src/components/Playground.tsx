import { useCallback, useEffect, useRef, useState } from 'react';
import useMediaStream from 'use-media-stream';
import './playground.css';

/**
 * The live demo. Renders with `client:only="react"` because the hook reads `navigator`, and
 * Starlight prerenders every page.
 *
 * Imports `use-media-stream` through the Vite alias in astro.config.mjs, which points at
 * ../../src — so this runs the real source and edits to the hook hot-reload here.
 */

type LogFn = (msg: string) => void;

const errText = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : e ? String(e) : '—');

function Row({ label, value }: { label: string; value: unknown }) {
  const ok = value === true;
  const bad = value === false;
  return (
    <div className="pg-row">
      <span className="pg-k">{label}</span>
      <span className={`pg-v ${ok ? 'pg-ok' : ''} ${bad ? 'pg-bad' : ''}`}>
        {value === undefined || value === null || value === '' ? '—' : String(value)}
      </span>
    </div>
  );
}

function Panel({ log }: { log: LogFn }) {
  const m = useMediaStream();
  const videoRef = useRef<HTMLVideoElement>(null);

  // constraint editor
  const [width, setWidth] = useState(1280);
  const [height, setHeight] = useState(720);
  const [facingMode, setFacingMode] = useState('user');

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = m.stream;
  }, [m.stream]);

  // user-supplied listeners, kept in refs so add/remove pass the same identity
  const listeners = useRef({
    videoEnded: () => log('event: video track "ended"'),
    audioEnded: () => log('event: audio track "ended"'),
    videoMute: () => log('event: video track "mute"'),
    audioMute: () => log('event: audio track "mute"'),
    videoUnmute: () => log('event: video track "unmute"'),
    audioUnmute: () => log('event: audio track "unmute"'),
  }).current;

  const run = async (name: string, fn: () => unknown) => {
    log(`call: ${name}()`);
    try {
      const r = await fn();
      if (r !== undefined) log(`  ↳ ${r === null ? 'null' : r instanceof MediaStream ? `MediaStream(${r.getTracks().length} tracks)` : Array.isArray(r) ? `${r.length} devices` : String(r)}`);
    } catch (e) {
      log(`  ↳ THREW ${errText(e)}`);
    }
  };

  const setConstraints = (constraints: MediaStreamConstraints, resetStream: boolean) =>
    run('updateMediaDeviceConstraints', () => m.updateMediaDeviceConstraints({ constraints, resetStream }));

  return (
    <div className="pg-grid">
      <section>
        <h2>Preview</h2>
        <video ref={videoRef} autoPlay playsInline muted className="pg-video" />
        <p className="pg-hint">
          Watch your camera LED. It should be off whenever <code>stream</code> is <code>—</code>.
        </p>
      </section>

      <section>
        <h2>State</h2>
        <Row label="isSupported" value={m.isSupported} />
        <Row label="isStreaming" value={m.isStreaming} />
        <Row label="stream" value={m.stream ? `MediaStream(${m.stream.getTracks().length} tracks)` : null} />
        <Row label="isAudioMuted" value={m.isAudioMuted} />
        <Row label="isVideoMuted" value={m.isVideoMuted} />
        <Row label="getStreamRequest" value={m.getStreamRequest} />
        <Row label="getMediaDevicesRequest" value={m.getMediaDevicesRequest} />
        <Row label="error" value={errText(m.error)} />
        <h3>Selected track settings</h3>
        <Row label="audioTrackDeviceId" value={m.selectedAudioTrackDeviceId} />
        <Row label="videoTrackDeviceId" value={m.selectedVideoTrackDeviceId} />
        <Row label="width" value={m.selectedVideoTrackDeviceWidth} />
        <Row label="height" value={m.selectedVideoTrackDeviceHeight} />
        <Row label="aspectRatio" value={m.selectedVideoTrackDeviceAspectRatio} />
      </section>

      <section>
        <h2>Stream</h2>
        <div className="pg-btns">
          <button onClick={() => run('start', m.start)}>start()</button>
          <button onClick={() => run('stop', m.stop)}>stop()</button>
          <button onClick={() => run('getMediaDevices', m.getMediaDevices)}>getMediaDevices()</button>
        </div>

        <h2>Mute (toggles track.enabled)</h2>
        <div className="pg-btns">
          <button onClick={() => run('muteAudio', m.muteAudio)}>muteAudio()</button>
          <button onClick={() => run('unmuteAudio', m.unmuteAudio)}>unmuteAudio()</button>
          <button onClick={() => run('muteVideo', m.muteVideo)}>muteVideo()</button>
          <button onClick={() => run('unmuteVideo', m.unmuteVideo)}>unmuteVideo()</button>
        </div>

        <h2>Event listeners</h2>
        <div className="pg-btns">
          <button onClick={() => { m.addVideoEndedEventListener(listeners.videoEnded); log('added videoEnded'); }}>+ videoEnded</button>
          <button onClick={() => { m.addAudioEndedEventListener(listeners.audioEnded); log('added audioEnded'); }}>+ audioEnded</button>
          <button onClick={() => { m.addVideoMuteEventListener(listeners.videoMute); log('added videoMute'); }}>+ videoMute</button>
          <button onClick={() => { m.addAudioMuteEventListener(listeners.audioMute); log('added audioMute'); }}>+ audioMute</button>
          <button onClick={() => { m.addVideoUnmuteEventListener(listeners.videoUnmute); log('added videoUnmute'); }}>+ videoUnmute</button>
          <button onClick={() => { m.addAudioUnmuteEventListener(listeners.audioUnmute); log('added audioUnmute'); }}>+ audioUnmute</button>
        </div>
        <div className="pg-btns">
          <button onClick={() => { m.removeVideoEndedEventListener(listeners.videoEnded); log('removed videoEnded'); }}>− videoEnded</button>
          <button onClick={() => { m.removeAudioEndedEventListener(listeners.audioEnded); log('removed audioEnded'); }}>− audioEnded</button>
          <button onClick={() => { m.removeVideoMuteEventListener(listeners.videoMute); log('removed videoMute'); }}>− videoMute</button>
          <button onClick={() => { m.removeAudioMuteEventListener(listeners.audioMute); log('removed audioMute'); }}>− audioMute</button>
          <button onClick={() => { m.removeVideoUnmuteEventListener(listeners.videoUnmute); log('removed videoUnmute'); }}>− videoUnmute</button>
          <button onClick={() => { m.removeAudioUnmuteEventListener(listeners.audioUnmute); log('removed audioUnmute'); }}>− audioUnmute</button>
        </div>
        <p className="pg-hint">
          Fire an <code>ended</code> event by unplugging the camera, or via the devtools console:{' '}
          <code>$0.srcObject.getVideoTracks()[0].stop()</code> on the video element.
        </p>
      </section>

      <section>
        <h2>Devices <small>({m.devices.length})</small></h2>
        <p className="pg-hint">Labels stay blank until permission is granted — call getMediaDevices().</p>

        <label>
          Audio input
          <select
            value={m.selectedAudioTrackDeviceId ?? ''}
            onChange={(e) => setConstraints({ audio: { deviceId: e.target.value } }, true)}
          >
            <option value="">— select —</option>
            {m.audioInputDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>
            ))}
          </select>
        </label>

        <label>
          Video input
          <select
            value={m.selectedVideoTrackDeviceId ?? ''}
            onChange={(e) => setConstraints({ video: { deviceId: e.target.value } }, true)}
          >
            <option value="">— select —</option>
            {m.videoInputDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>
            ))}
          </select>
        </label>

        <label>
          Audio output <small>(listed only, not selectable via constraints)</small>
          <select disabled>
            {m.audioOutputDevices.length === 0 && <option>— none —</option>}
            {m.audioOutputDevices.map((d) => (
              <option key={d.deviceId}>{d.label || d.deviceId}</option>
            ))}
          </select>
        </label>

        <h2>Constraints</h2>
        <div className="pg-inline">
          <label>w<input type="number" value={width} onChange={(e) => setWidth(+e.target.value)} /></label>
          <label>h<input type="number" value={height} onChange={(e) => setHeight(+e.target.value)} /></label>
          <label>
            facing
            <select value={facingMode} onChange={(e) => setFacingMode(e.target.value)}>
              <option value="user">user</option>
              <option value="environment">environment</option>
            </select>
          </label>
        </div>
        <div className="pg-btns">
          <button onClick={() => setConstraints({ video: { width, height, facingMode } }, true)}>
            apply + reset stream
          </button>
          <button onClick={() => setConstraints({ video: { width, height, facingMode } }, false)}>
            apply only
          </button>
        </div>
      </section>
    </div>
  );
}

export default function Playground() {
  const [mounted, setMounted] = useState(true);
  const [lines, setLines] = useState<string[]>([]);

  const log = useCallback((msg: string) => {
    const t = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setLines((l) => [`${t}  ${msg}`, ...l].slice(0, 200));
  }, []);

  return (
    <div className="pg">
      <div className="pg-bar">
        <p className="pg-hint">
          Runs entirely in your browser against the real hook. Your camera never leaves the page.
        </p>
        <div className="pg-btns">
          <button
            className={mounted ? 'pg-danger' : 'pg-primary'}
            onClick={() => {
              log(mounted ? '— UNMOUNT hook —' : '— MOUNT hook —');
              setMounted(!mounted);
            }}
          >
            {mounted ? 'Unmount hook' : 'Mount hook'}
          </button>
          <button onClick={() => setLines([])}>clear log</button>
        </div>
      </div>

      {mounted ? (
        <Panel log={log} />
      ) : (
        <p className="pg-unmounted">
          The hook is unmounted. Your camera light should be off — nothing was cleaned up by hand.
        </p>
      )}

      <section className="pg-logbox">
        <h2>Log</h2>
        <pre>{lines.join('\n') || 'nothing yet'}</pre>
      </section>
    </div>
  );
}
