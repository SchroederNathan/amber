import type { IntentKind } from '@/lib/intents';
import { SymbolView } from '@/components/ui/symbol';
import type { SFSymbol } from 'expo-symbols';
import { Pressable, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

// The app owns the kind → icon mapping so the model can never emit an invalid
// SF Symbol. `sparkles` is a forward-compat fallback for a kind a newer backend
// might add before this build knows about it.
const ICONS: Record<IntentKind, SFSymbol> = {
  open_url: 'arrow.up.right.square',
  copy: 'doc.on.doc',
  web_search: 'magnifyingglass',
  open_maps: 'map',
  call: 'phone',
  email: 'envelope',
  message: 'message',
  add_event: 'calendar',
};

export function IntentChip({
  kind,
  label,
  onPress,
}: {
  kind: IntentKind;
  label: string;
  onPress: () => void;
}) {
  const { theme } = useUnistyles();
  const icon = ICONS[kind] ?? 'sparkles';
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
      onPress={onPress}
      hitSlop={theme.spacing.sm}
      pressRetentionOffset={theme.control.pressRetentionOffset}
    >
      <SymbolView name={icon} size={14} tintColor={theme.colors.primaryText} />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.primarySoft,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.full,
  },
  chipPressed: {
    opacity: theme.opacity.pressed,
  },
  label: {
    ...theme.type.label,
    color: theme.colors.primaryText,
  },
}));
