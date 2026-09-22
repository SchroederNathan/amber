// Kept independent of React/native APIs so lifecycle and storage failures can be tested.
export type LockStatus =
  'loading' | 'disabled' | 'locked' | 'unlocked' | 'error';
export type LockSnapshot = {
  status: LockStatus;
  busy: boolean;
  foreground: boolean;
  message: string | null;
};
export type LockDependencies = {
  readEnabled: () => Promise<boolean>;
  writeEnabled: (enabled: boolean) => Promise<void>;
  enroll: () => Promise<void>;
  verify: () => Promise<boolean>;
  preparePrivacy: () => Promise<void>;
};

export class AppLockController {
  private snapshot: LockSnapshot;
  private listeners = new Set<() => void>();
  private generation = 0;
  private disposed = false;

  private dependencies: LockDependencies;

  constructor(dependencies: LockDependencies, foreground: boolean) {
    this.dependencies = dependencies;
    this.snapshot = {
      status: 'loading',
      busy: false,
      foreground,
      message: null,
    };
  }

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<LockSnapshot>) {
    if (this.disposed) return;
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  async load() {
    this.disposed = false;
    const generation = ++this.generation;
    this.update({ status: 'loading', message: null });
    try {
      const enabled = await this.dependencies.readEnabled();
      if (enabled) await this.dependencies.preparePrivacy();
      if (generation === this.generation)
        this.update({ status: enabled ? 'locked' : 'disabled' });
    } catch {
      // A read error must never be interpreted as opting out.
      if (generation === this.generation)
        this.update({
          status: 'error',
          message:
            'Amber could not read your privacy settings. Please try again.',
        });
    }
  }

  activityChanged(activity: string) {
    const foreground = activity === 'active';
    // Native biometric dialogs can briefly make iOS inactive. A real background
    // transition always invalidates an in-flight result, including enrollment.
    const invalidate =
      activity === 'background' || (!foreground && !this.snapshot.busy);
    if (invalidate && this.snapshot.status !== 'loading') this.generation++;
    this.update({
      foreground,
      ...(invalidate && this.snapshot.status === 'unlocked'
        ? { status: 'locked' as const }
        : {}),
    });
  }

  async authenticate(action: 'unlock' | 'enable' | 'disable') {
    const { status, foreground, busy } = this.snapshot;
    if (busy || !foreground || this.disposed) return false;
    if (
      action === 'enable'
        ? status !== 'disabled'
        : !['locked', 'unlocked'].includes(status)
    )
      return false;
    const generation = this.generation;
    this.update({ busy: true, message: null });
    try {
      if (action === 'enable') await this.dependencies.enroll();
      else if (!(await this.dependencies.verify())) {
        throw new Error('invalid-key');
      }
      if (this.disposed || generation !== this.generation) return false;
      if (action === 'enable') {
        await this.dependencies.preparePrivacy();
        await this.dependencies.writeEnabled(true);
        this.update({ status: 'locked' });
      } else if (action === 'disable') {
        await this.dependencies.writeEnabled(false);
        this.update({ status: 'disabled' });
        return true;
      }
      if (this.disposed || generation !== this.generation) return false;
      this.update({ status: 'unlocked' });
      return true;
    } catch {
      this.update({
        message:
          action === 'enable'
            ? 'Biometric lock was not enabled. Check Face ID or fingerprint settings and try again.'
            : 'Amber stays locked until verification succeeds. Try again, or sign out and sign in to reset the lock.',
      });
      return false;
    } finally {
      this.update({ busy: false });
    }
  }

  dispose() {
    this.disposed = true;
    this.generation++;
    this.listeners.clear();
  }
}
