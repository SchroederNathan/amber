import { Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export function Wordmark({ size = 26 }: { size?: number }) {
  return <Text style={[styles.wordmark, { fontSize: size }]}>amber</Text>;
}

const styles = StyleSheet.create((theme) => ({
  wordmark: {
    fontFamily: theme.fonts.display,
    color: theme.colors.foreground,
    letterSpacing: 0.5,
  },
}));
