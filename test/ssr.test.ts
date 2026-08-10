// No `@vitest-environment` on purpose: this runs in plain Node, the way a server render does.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import useMediaStream from '../src/index.js';

const Probe = () => createElement('div', null, String(useMediaStream().isSupported));

describe('server rendering', () => {
  const realNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  afterEach(() => {
    if (realNavigator) Object.defineProperty(globalThis, 'navigator', realNavigator);
  });

  /**
   * Node only gained a global `navigator` in 21, and `engines.node` allows 18. `navigator?.x`
   * looks defensive but still throws ReferenceError on an undeclared identifier, so this used
   * to take down the whole render on any supported LTS.
   */
  it('renders when there is no global navigator at all', () => {
    Reflect.deleteProperty(globalThis, 'navigator');
    expect(typeof navigator).toBe('undefined');

    expect(() => renderToString(createElement(Probe))).not.toThrow();
    expect(renderToString(createElement(Probe))).toBe('<div>false</div>');
  });

  it('renders when navigator exists but has no mediaDevices, as on a server', () => {
    Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node' }, configurable: true });

    expect(renderToString(createElement(Probe))).toBe('<div>false</div>');
  });
});
