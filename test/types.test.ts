import { describe, expect, it } from 'vitest';
import useMediaStream, {
  REQUEST_STATES,
  useMediaStream as namedUseMediaStream,
  type RequestState,
  type UpdateMediaDeviceConstraintsOptions,
  type UseMediaStreamProps,
  type UseMediaStreamReturn,
} from '../src/index.js';

/**
 * Compile-time assertions. These are checked by `npm run typecheck`, not by vitest — each
 * `@ts-expect-error` fails the build if the error it expects ever stops happening, so this
 * catches the type widening back out as well as it catches it narrowing too far.
 */

// props, and every field on them, are optional
const _noProps: UseMediaStreamProps = {};
const _nullConstraints: UseMediaStreamProps = { mediaDeviceConstraints: null };

// resetStream has a default, so it must not be required
const _minimalOptions: UpdateMediaDeviceConstraintsOptions = { constraints: { video: true } };

// request states are a literal union, not string
const _validState: RequestState = 'PENDING';
// @ts-expect-error 'DONE' is not one of the four request states
const _invalidState: RequestState = 'DONE';

// error is narrowed to Error, so consumers do not need an `instanceof` dance
const _error: UseMediaStreamReturn['error'] = new Error('boom');
const _noError: UseMediaStreamReturn['error'] = null;
// @ts-expect-error error is Error | null, never a bare string
const _badError: UseMediaStreamReturn['error'] = 'boom';

// the returned request states carry the union through
const _returnedState: RequestState = {} as UseMediaStreamReturn['getStreamRequest'];

describe('public API', () => {
  it('exposes the hook as both a default and a named export', () => {
    expect(namedUseMediaStream).toBe(useMediaStream);
  });

  it('exposes every request state', () => {
    expect(REQUEST_STATES).toEqual({
      IDLE: 'IDLE',
      PENDING: 'PENDING',
      FULFILLED: 'FULFILLED',
      REJECTED: 'REJECTED',
    });
  });
});
