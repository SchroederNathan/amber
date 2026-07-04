// Unistyles config MUST run before expo-router boots the app — otherwise
// components' StyleSheet.create calls execute before StyleSheet.configure,
// adaptive theming never arms (hasAdaptiveThemes stays false), and freshly
// mounted screens intermittently paint in the default (light) theme.
import './src/unistyles';
import 'expo-router/entry';
