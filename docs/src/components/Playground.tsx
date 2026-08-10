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
type Tab = 'devices' | 'constraints' | 'events';

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
  const [tab, setTab] = useState<Tab>('devices');

  const [width, setWidth] = useState(1280);
  const [height, setHeight] = useState(720);
  const [facingMode, setFacingMode] = useState('user');

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = m.stream;
  }, [m.stream]);

  // kept in a ref so add/remove pass the same function identity
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
      if (r !== undefined) {
        log(
          `  ↳ ${
            r === null
              ? 'null'
              : r instanceof MediaStream
                ? `MediaStream(${r.getTracks().length} tracks)`
                : Array.isArray(r)
                  ? `${r.length} devices`
                  : String(r)
          }`,
        );
      }
    } catch (e) {
      log(`  ↳ THREW ${errText(e)}`);
    }
  };

  const setConstraints = (constraints: MediaStreamConstraints, resetStream: boolean) =>
    run('updateMediaDeviceConstraints', () => m.updateMediaDeviceConstraints({ constraints, resetStream }));

  /** add/remove pair for one track event, so twelve buttons fit in six rows */
  const eventRows: Array<[string, () => void, () => void]> = [
    ['video ended', () => m.addVideoEndedEventListener(listeners.videoEnded), () => m.removeVideoEndedEventListener(listeners.videoEnded)],
    ['audio ended', () => m.addAudioEndedEventListener(listeners.audioEnded), () => m.removeAudioEndedEventListener(listeners.audioEnded)],
    ['video mute', () => m.addVideoMuteEventListener(listeners.videoMute), () => m.removeVideoMuteEventListener(listeners.videoMute)],
    ['audio mute', () => m.addAudioMuteEventListener(listeners.audioMute), () => m.removeAudioMuteEventListener(listeners.audioMute)],
    ['video unmute', () => m.addVideoUnmuteEventListener(listeners.videoUnmute), () => m.removeVideoUnmuteEventListener(listeners.videoUnmute)],
    ['audio unmute', () => m.addAudioUnmuteEventListener(listeners.audioUnmute), () => m.removeAudioUnmuteEventListener(listeners.audioUnmute)],
  ];

  return (
    <div className="pg-layout">
      <div className="pg-stage">
        <div className="pg-videowrap">
          <video ref={videoRef} autoPlay playsInline muted className="pg-video" />
          {!m.stream && <span className="pg-videonote">no stream — press start()</span>}
        </div>

        <div className="pg-btns">
          <button className="pg-primary" onClick={() => run('start', m.start)}>start()</button>
          <button className="pg-danger" onClick={() => run('stop', m.stop)}>stop()</button>
          <button onClick={() => run('getMediaDevices', m.getMediaDevices)}>getMediaDevices()</button>
          <span className="pg-sep" />
          <button onClick={() => run('muteAudio', m.muteAudio)}>muteAudio</button>
          <button onClick={() => run('unmuteAudio', m.unmuteAudio)}>unmuteAudio</button>
          <button onClick={() => run('muteVideo', m.muteVideo)}>muteVideo</button>
          <button onClick={() => run('unmuteVideo', m.unmuteVideo)}>unmuteVideo</button>
        </div>

        <div className="pg-tabs" role="tablist">
          {(['devices', 'constraints', 'events'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? 'pg-tab pg-tab-on' : 'pg-tab'}
              onClick={() => setTab(t)}
            >
              {t}
              {t === 'devices' && m.devices.length > 0 && <span className="pg-badge">{m.devices.length}</span>}
            </button>
          ))}
        </div>

        <div className="pg-tabpanel">
          {tab === 'devices' && (
            <>
              <div className="pg-inline">
                <label>
                  audio input
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
                  video input
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
                  audio output <small>(read-only)</small>
                  <select disabled>
                    {m.audioOutputDevices.length === 0 && <option>— none —</option>}
                    {m.audioOutputDevices.map((d) => (
                      <option key={d.deviceId}>{d.label || d.deviceId}</option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="pg-hint">Labels stay blank until permission is granted — call getMediaDevices().</p>
            </>
          )}

          {tab === 'constraints' && (
            <>
              <div className="pg-inline">
                <label>width<input type="number" value={width} onChange={(e) => setWidth(+e.target.value)} /></label>
                <label>height<input type="number" value={height} onChange={(e) => setHeight(+e.target.value)} /></label>
                <label>
                  facingMode
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
              <p className="pg-hint">
                Merged over the defaults, so <code>facingMode</code> survives a width-only change.
              </p>
            </>
          )}

          {tab === 'events' && (
            <>
              <div className="pg-events">
                {eventRows.map(([label, add, remove]) => (
                  <div key={label} className="pg-eventrow">
                    <span>{label}</span>
                    <button onClick={() => { add(); log(`added ${label}`); }}>+</button>
                    <button onClick={() => { remove(); log(`removed ${label}`); }}>−</button>
                  </div>
                ))}
              </div>
              <p className="pg-hint">
                Fire <code>ended</code> by unplugging the camera, or from devtools:{' '}
                <code>$0.srcObject.getVideoTracks()[0].stop()</code> on the video.
              </p>
            </>
          )}
        </div>
      </div>

      <aside className="pg-state">
        <h2>State</h2>
        <Row label="isSupported" value={m.isSupported} />
        <Row label="isStreaming" value={m.isStreaming} />
        <Row label="stream" value={m.stream ? `${m.stream.getTracks().length} tracks` : null} />
        <Row label="isAudioMuted" value={m.isAudioMuted} />
        <Row label="isVideoMuted" value={m.isVideoMuted} />
        <Row label="getStreamRequest" value={m.getStreamRequest} />
        <Row label="getMediaDevicesRequest" value={m.getMediaDevicesRequest} />
        <Row label="error" value={errText(m.error)} />
        <h3>Selected track</h3>
        <Row label="audioDeviceId" value={m.selectedAudioTrackDeviceId} />
        <Row label="videoDeviceId" value={m.selectedVideoTrackDeviceId} />
        <Row label="width" value={m.selectedVideoTrackDeviceWidth} />
        <Row label="height" value={m.selectedVideoTrackDeviceHeight} />
        <Row label="aspectRatio" value={m.selectedVideoTrackDeviceAspectRatio} />
      </aside>
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
        <p className="pg-hint">Runs in your browser against the real hook. Nothing is uploaded.</p>
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

      <details className="pg-logbox" open>
        <summary>Log</summary>
        <pre>{lines.join('\n') || 'nothing yet'}</pre>
      </details>
    </div>
  );
}
