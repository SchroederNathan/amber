import { fadeIn } from '@/styles/motion';
import { ThemedText } from '@/components/ui/themed-text';
import Animated from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

type Props = {
  title: string;
  message: string;
};

export function EmptyState({ title, message }: Props) {
  return (
    <Animated.View entering={fadeIn} style={styles.container}>
      <ThemedText variant="title" style={styles.title}>{title}</ThemedText>
      <ThemedText variant="subhead" style={styles.message}>{message}</ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.gap(4),
    paddingBottom: rt.insets.bottom + theme.gap(2),
    gap: theme.gap(1),
  },
  title: {
    color: theme.colors.foreground,
  },
  message: {
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 21,
  },
}));
