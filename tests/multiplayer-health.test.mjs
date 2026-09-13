import test from 'node:test';
import assert from 'node:assert/strict';
import {checkBackendHealth} from '../scripts/multiplayer-health.mjs';
import {PROTOCOL_VERSION} from '../dist/multiplayer-protocol.js';

const health = new URL('https://backend.example/health');
const ready = () => Response.json({ok: true, version: PROTOCOL_VERSION});

test('a healthy compatible backend passes on the first check', async () => {
  const status = await checkBackendHealth(health, {
    fetchImpl: async (url, options) => {
      assert.equal(url.href, health.href);
      assert.ok(options.signal instanceof AbortSignal);
      return ready();
    },
    wait: () => assert.fail('healthy backend must not wait'),
  });
  assert.equal(status.version, PROTOCOL_VERSION);
});

test('a sleeping backend can recover from timeouts, gateway errors and a loading page', async () => {
  const responses = [new Error('timeout'), new Response('', {status: 503}), new Response('<html>Waking up</html>'), ready()];
  const waits = [], messages = [];
  await checkBackendHealth(health, {
    fetchImpl: async () => { const next = responses.shift(); if (next instanceof Error) throw next; return next; },
    wait: async ms => waits.push(ms), log: message => messages.push(message),
  });
  assert.equal(responses.length, 0);
  assert.deepEqual(waits, [5000, 5000, 5000]);
  assert.equal(messages.length, 3);
});

test('incompatible and unhealthy protocols fail without waiting', async () => {
  for (const status of [{ok: true, version: PROTOCOL_VERSION - 1}, {ok: false, version: PROTOCOL_VERSION}, null]) {
    await assert.rejects(checkBackendHealth(health, {
      fetchImpl: async () => Response.json(status),
      wait: () => assert.fail('protocol errors must not retry'),
    }), /not compatible/);
  }
});

test('a wrong health endpoint fails immediately', async () => {
  await assert.rejects(checkBackendHealth(health, {
    fetchImpl: async () => new Response('', {status: 404}),
    wait: () => assert.fail('configuration errors must not retry'),
  }), /health check failed \(404\)/);
});

test('an unavailable backend fails after a bounded number of retries', async () => {
  let calls = 0, waits = 0;
  await assert.rejects(checkBackendHealth(health, {
    fetchImpl: async () => { calls++; return new Response('', {status: 502}); },
    wait: async () => { waits++; }, log() {},
  }), /did not become ready after 8 health checks/);
  assert.equal(calls, 8);
  assert.equal(waits, 7);
});
