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
export type LockOptions = {
  // How long Amber may stay out of the foreground before it locks again.
  graceMs?: number;
  // Start verification without a tap when the lock screen appears.
  autoPrompt?: boolean;
  now?: () => number;
};

export const LOCK_GRACE_MS = 2 * 60 * 1000;

export class AppLockController {
  private snapshot: LockSnapshot;
  private listeners = new Set<() => void>();
  private generation = 0;
  private disposed = false;
  private awaySince: number | null = null;
  private promptPending = false;

  private dependencies: LockDependencies;
  private graceMs: number;
  private autoPrompt: boolean;
  private now: () => number;

  constructor(
    dependencies: LockDependencies,
    foreground: boolean,
    { graceMs = LOCK_GRACE_MS, autoPrompt = true, now = Date.now }: LockOptions = {},
  ) {
    this.dependencies = dependencies;
    this.graceMs = graceMs;
    this.autoPrompt = autoPrompt;
    this.now = now;
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
      if (generation === this.generation) {
        this.promptPending = enabled;
        this.update({ status: enabled ? 'locked' : 'disabled' });
        this.promptIfPending();
      }
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
    const { busy, status } = this.snapshot;
    // Native biometric dialogs can briefly make iOS inactive. A real background
    // transition always invalidates an in-flight result, including enrollment.
    const invalidate = activity === 'background' || (!foreground && !busy);
    if (invalidate && status !== 'loading') this.generation++;
    if (invalidate) this.awaySince ??= this.now();
    // Returning from the background is when the user expects Face ID again.
    if (activity === 'background') this.promptPending = true;
    let next = status;
    if (foreground && this.awaySince !== null) {
      const away = this.now() - this.awaySince;
      this.awaySince = null;
      // A clock that moved backwards cannot prove the grace period is running.
      if (status === 'unlocked' && (away >= this.graceMs || away < 0)) {
        next = 'locked';
        this.promptPending = true;
      }
    }
    if (foreground && next !== 'locked') this.promptPending = false;
    this.update({ foreground, status: next });
    this.promptIfPending();
  }

  // One automatic prompt per lock, so a cancelled prompt does not loop.
  private promptIfPending() {
    const { status, foreground, busy } = this.snapshot;
    if (!this.autoPrompt || !this.promptPending || this.disposed) return;
    if (status !== 'locked' || !foreground || busy) return;
    this.promptPending = false;
    void this.authenticate('unlock');
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
      this.promptIfPending();
    }
  }

  dispose() {
    this.disposed = true;
    this.generation++;
    this.listeners.clear();
  }
}
