import {setTimeout as delay} from 'node:timers/promises';
import {PROTOCOL_VERSION} from '../dist/multiplayer-protocol.js';

// Free Render instances can take a minute to wake. Keep retries bounded, and
// reject configuration/protocol errors immediately instead of publishing them.
export async function checkBackendHealth(health, {fetchImpl = fetch, wait = delay, log = console.log} = {}) {
  const attempts = 8;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let response, status;
    try {
      response = await fetchImpl(health, {signal: AbortSignal.timeout(15000)});
      if (response.ok) status = await response.json();
    } catch (error) {
      lastError = error;
    }
    if (response?.ok && status !== undefined) {
      if (!status?.ok || status.version !== PROTOCOL_VERSION) throw Error('Backend protocol is not compatible with this game.');
      return status;
    }
    if (response && !response.ok) {
      lastError = Error(`Multiplayer health check failed (${response.status}).`);
      await response.body?.cancel();
      if (![429, 502, 503, 504].includes(response.status)) throw lastError;
    }
    if (attempt === attempts) throw new Error(`Multiplayer backend did not become ready after ${attempts} health checks. Check the Render service logs and retry deployment.`, {cause: lastError});
    log(`Waiting for multiplayer backend to wake (${attempt}/${attempts}); retrying in 5 seconds.`);
    await wait(5000);
  }
}
