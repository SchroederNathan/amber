import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

type Props = {
  icon: SFSymbol;
  title: string;
  message: string;
};

export function EmptyState({ icon, title, message }: Props) {
  const { theme } = useUnistyles();
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.container}>
      <View style={styles.iconCircle}>
        <SymbolView name={icon} size={30} tintColor={theme.colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    alignItems: 'center',
    paddingVertical: theme.gap(8),
    paddingHorizontal: theme.gap(4),
    gap: theme.gap(1),
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.gap(1),
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: 22,
    color: theme.colors.foreground,
  },
  message: {
    fontFamily: theme.fonts.regular,
    fontSize: 15,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 21,
  },
}));
