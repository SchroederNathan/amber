import { Box, DropdownMenu, DropdownMenuItem, Host, Text } from '@expo/ui/jetpack-compose';
import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import type { MenuAction } from './action-menu';

/**
 * Android has no ActionSheetIOS, so overflow actions open a Material dropdown
 * anchored where `anchor` renders. The Compose host only mounts while the menu
 * is open, so a long feed of cards does not pay for one host per card.
 */
export function useActionMenu(): { open: (actions: MenuAction[]) => void; anchor: ReactNode } {
  const { theme } = useUnistyles();
  const [actions, setActions] = useState<MenuAction[] | null>(null);
  const close = useCallback(() => setActions(null), []);

  const anchor = actions ? (
    <Host style={styles.anchor}>
      <DropdownMenu expanded onDismissRequest={close} color={theme.colors.surface}>
        <DropdownMenu.Trigger>
          <Box />
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.label}
              onClick={() => {
                close();
                action.run();
              }}
            >
              <DropdownMenuItem.Text>
                <Text color={action.destructive ? theme.colors.danger : theme.colors.foreground}>
                  {action.label}
                </Text>
              </DropdownMenuItem.Text>
            </DropdownMenuItem>
          ))}
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  ) : null;

  return { open: setActions, anchor };
}

const styles = StyleSheet.create({
  // A point at the bottom-right corner of the button's parent; the menu drops
  // from there, the way a Material overflow menu drops from its icon.
  anchor: { position: 'absolute', right: 0, bottom: 0, width: 1, height: 1 },
});
