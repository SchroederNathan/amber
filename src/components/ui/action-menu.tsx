import { useCallback, type ReactNode } from 'react';
import { ActionSheetIOS } from 'react-native';

export type MenuAction = { label: string; destructive?: boolean; run: () => void };

/**
 * Overflow actions behind a "…" button, shown as the system action sheet.
 * Render `anchor` inside the button's positioned parent: iOS leaves it empty,
 * while Android (action-menu.android.tsx) drops its Material menu from there.
 */
export function useActionMenu(): { open: (actions: MenuAction[]) => void; anchor: ReactNode } {
  const open = useCallback((actions: MenuAction[]) => {
    const destructiveIndex = actions.findIndex((a) => a.destructive);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...actions.map((a) => a.label), 'Cancel'],
        destructiveButtonIndex: destructiveIndex >= 0 ? destructiveIndex : undefined,
        cancelButtonIndex: actions.length,
      },
      (index) => {
        actions[index]?.run();
      },
    );
  }, []);
  return { open, anchor: null };
}
