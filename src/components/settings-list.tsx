import { SymbolView } from '@/components/ui/symbol';
import type { SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

/** A titled, rounded group of one-line settings rows. */
export function SettingsGroup({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string | null;
  children: ReactNode;
}) {
  return (
    <View style={styles.group}>
      {title && <Text style={styles.groupTitle}>{title}</Text>}
      <View style={styles.card}>{children}</View>
      {footer && (
        <Text accessibilityRole="alert" style={styles.footer}>
          {footer}
        </Text>
      )}
    </View>
  );
}

type RowProps = {
  icon: SFSymbol;
  label: string;
  /** Right-hand content: a switch, a status label, or nothing for a chevron. */
  trailing?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  testID?: string;
};

/** One line: icon, label, and a trailing control. Pressable rows get a chevron by default. */
export function SettingsRow({
  icon,
  label,
  trailing,
  onPress,
  destructive = false,
  disabled = false,
  testID,
}: RowProps) {
  const { theme } = useUnistyles();
  const tint = destructive ? theme.colors.danger : theme.colors.foreground;
  const content = (
    <>
      <SymbolView name={icon} size={22} tintColor={tint} style={styles.icon} />
      <Text numberOfLines={1} style={[styles.label, destructive && styles.labelDestructive]}>
        {label}
      </Text>
      {trailing ??
        (onPress && !destructive ? (
          <SymbolView name="chevron.right" size={15} weight="semibold" tintColor={theme.colors.faint} />
        ) : null)}
    </>
  );

  if (!onPress) {
    return (
      <View testID={testID} style={[styles.row, disabled && styles.rowDisabled]}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
        disabled && styles.rowDisabled,
      ]}
    >
      {content}
    </Pressable>
  );
}

/** Muted status text for a row's trailing slot. */
export function SettingsValue({ children }: { children: string }) {
  return (
    <Text numberOfLines={1} style={styles.value}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create((theme) => ({
  group: { alignSelf: 'stretch', gap: theme.spacing.sm },
  groupTitle: {
    ...theme.type.subheadLabel,
    color: theme.colors.muted,
    paddingHorizontal: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.sm,
  },
  footer: {
    ...theme.type.footnote,
    color: theme.colors.muted,
    paddingHorizontal: theme.spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
    minHeight: theme.control.largeHeight,
    paddingHorizontal: theme.spacing.xl,
  },
  rowPressed: { opacity: theme.opacity.pressedSurface },
  rowDisabled: { opacity: theme.opacity.disabled },
  icon: { width: 26, height: 26 },
  label: {
    flex: 1,
    fontFamily: theme.fonts.medium,
    fontSize: 18,
    color: theme.colors.foreground,
  },
  labelDestructive: { color: theme.colors.danger },
  value: { ...theme.type.subhead, color: theme.colors.muted },
}));
