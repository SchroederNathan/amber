import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export function TagChip({ label, emphasized }: { label: string; emphasized?: boolean }) {
  return (
    <View style={[styles.chip, emphasized && styles.chipEmphasized]}>
      <Text style={[styles.label, emphasized && styles.labelEmphasized]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  chip: {
    backgroundColor: theme.colors.surfaceMuted,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.full,
  },
  chipEmphasized: {
    backgroundColor: theme.colors.primarySoft,
  },
  label: {
    ...theme.type.label,
    color: theme.colors.muted,
  },
  labelEmphasized: {
    color: theme.colors.primaryText,
  },
}));
