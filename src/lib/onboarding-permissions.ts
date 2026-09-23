export type PermissionStep = 'camera' | 'photos' | 'biometrics';
type PhotoPermission = { granted: boolean; canAskAgain: boolean; accessPrivileges?: string };
type PermissionPorts = {
  camera: { hasPermission: boolean; canRequestPermission: boolean; requestPermission: () => Promise<boolean> };
  photos: { get: () => Promise<PhotoPermission>; request: () => Promise<PhotoPermission> };
  biometrics: { enabled: boolean; available: boolean; enable: () => Promise<boolean> };
};

// Keep platform permission decisions separate from the animated presentation.
// In particular, limited Photos access is sufficient; denial is never success.
export async function requestOnboardingPermission(step: PermissionStep, ports: PermissionPorts) {
  switch (step) {
    case 'camera': {
      const { camera } = ports;
      const allowed = camera.hasPermission || (camera.canRequestPermission && await camera.requestPermission());
      return { allowed, settingsNeeded: !allowed };
    }
    case 'photos': {
      const existing = await ports.photos.get();
      const result = existing.granted || existing.accessPrivileges === 'limited' || !existing.canAskAgain
        ? existing : await ports.photos.request();
      return {
        allowed: result.granted || result.accessPrivileges === 'limited',
        settingsNeeded: !result.canAskAgain,
      };
    }
    case 'biometrics': {
      const { biometrics } = ports;
      return {
        allowed: biometrics.enabled || !biometrics.available || await biometrics.enable(),
        settingsNeeded: false,
      };
    }
  }
}
