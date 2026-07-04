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
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 50,
  },
  chipEmphasized: {
    backgroundColor: theme.colors.primarySoft,
  },
  label: {
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    color: theme.colors.muted,
  },
  labelEmphasized: {
    color: theme.colors.primaryText,
  },
}));
