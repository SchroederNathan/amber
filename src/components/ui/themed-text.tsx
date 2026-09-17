import { Text, type TextProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

type Theme = import('react-native-unistyles').UnistylesThemes['light'];

export function ThemedText({
  variant = 'body',
  style,
  ...props
}: TextProps & { variant?: keyof Theme['type'] }) {
  return <Text {...props} style={[styles.text(variant), style]} />;
}

const styles = StyleSheet.create((theme) => ({
  text: (variant: keyof Theme['type']) => ({
    ...theme.type[variant],
    color: theme.colors.foreground,
  }),
}));
