import type { IntentKind } from '@/lib/intents';
import { SymbolView, type SFSymbol } from 'expo-symbols';
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
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
      onPress={onPress}
      hitSlop={6}
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
    gap: 6,
    backgroundColor: theme.colors.primarySoft,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 50,
  },
  chipPressed: {
    opacity: 0.7,
  },
  label: {
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    color: theme.colors.primaryText,
  },
}));
