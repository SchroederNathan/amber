export class InvalidAppIntent extends Error {}

type Invocation = { id: string; name: string };

/** Serialize snapshots and remember committed work until native acknowledgement succeeds. */
export function createIntentDelivery<T extends Invocation>(operations: {
  isActive: () => boolean;
  isHandled: (id: string) => boolean;
  markHandled: (id: string) => void;
  handle: (invocation: T) => Promise<boolean>;
  acknowledge: (id: string) => Promise<void>;
  onError: (invocation: T, error: unknown) => void;
}) {
  let queue = Promise.resolve();
  return (pending: T[]) => {
    const work = queue.then(async () => {
      for (const invocation of pending) {
        if (!operations.isActive()) return;
        try {
          if (!operations.isHandled(invocation.id)) {
            try {
              if (!(await operations.handle(invocation))) continue;
            } catch (error) {
              if (!(error instanceof InvalidAppIntent)) throw error;
              // Known, permanently invalid inputs cannot succeed on a later launch.
              operations.onError(invocation, error);
            }
            if (!operations.isActive()) return;
            operations.markHandled(invocation.id);
          }
          await operations.acknowledge(invocation.id);
        } catch (error) {
          operations.onError(invocation, error);
        }
      }
    });
    queue = work.catch(() => {});
    return work;
  };
}
