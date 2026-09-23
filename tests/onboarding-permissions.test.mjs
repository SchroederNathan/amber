import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestOnboardingPermission } from '../src/lib/onboarding-permissions.ts';

const unexpected = async () => { throw new Error('Unexpected native permission prompt'); };
const ports = () => ({
  camera: { hasPermission: false, canRequestPermission: false, requestPermission: unexpected },
  photos: { get: unexpected, request: unexpected },
  biometrics: { enabled: false, available: false, enable: unexpected },
});

test('already granted and permanently denied camera access never re-prompt', async () => {
  const p = ports();
  assert.deepEqual(await requestOnboardingPermission('camera', p), { allowed: false, settingsNeeded: true });
  p.camera.hasPermission = true;
  assert.equal((await requestOnboardingPermission('camera', p)).allowed, true);
});

test('limited Photos access advances without requesting broader access', async () => {
  const p = ports();
  p.photos.get = async () => ({ granted: false, canAskAgain: false, accessPrivileges: 'limited' });
  assert.equal((await requestOnboardingPermission('photos', p)).allowed, true);
});

test('photo denial stays on the step; a later Settings grant is read afresh', async () => {
  const p = ports();
  let granted = false;
  p.photos.get = async () => ({ granted, canAskAgain: false });
  assert.deepEqual(await requestOnboardingPermission('photos', p), { allowed: false, settingsNeeded: true });
  granted = true;
  assert.equal((await requestOnboardingPermission('photos', p)).allowed, true);
});

test('fresh permission requests honor cancellation and propagate native failures', async () => {
  const p = ports();
  p.camera.canRequestPermission = true;
  p.camera.requestPermission = async () => false;
  assert.equal((await requestOnboardingPermission('camera', p)).allowed, false);
  p.photos.get = async () => ({ granted: false, canAskAgain: true });
  p.photos.request = async () => ({ granted: true, canAskAgain: true, accessPrivileges: 'limited' });
  assert.equal((await requestOnboardingPermission('photos', p)).allowed, true);
  p.camera.requestPermission = async () => { throw new Error('Native failure'); };
  await assert.rejects(requestOnboardingPermission('camera', p), /Native failure/);
});

test('biometric setup only advances after enrollment succeeds; unavailable devices can continue', async () => {
  const p = ports();
  assert.equal((await requestOnboardingPermission('biometrics', p)).allowed, true);
  p.biometrics.available = true;
  p.biometrics.enable = async () => false;
  assert.equal((await requestOnboardingPermission('biometrics', p)).allowed, false);
  p.biometrics.enable = async () => true;
  assert.equal((await requestOnboardingPermission('biometrics', p)).allowed, true);
});
