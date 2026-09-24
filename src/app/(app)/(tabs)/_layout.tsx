import { NativeTabs } from 'expo-router/native-tabs';
import { useUnistyles } from 'react-native-unistyles';

export default function TabsLayout() {
  const { theme } = useUnistyles();
  // iOS draws a Liquid Glass bar tinted by `tintColor`. Android's Material bar
  // otherwise falls back to the stock lavender surface and pill, so it takes
  // the theme's roles and type explicitly.
  const android =
    process.env.EXPO_OS === 'android'
      ? {
          backgroundColor: theme.colors.background,
          indicatorColor: theme.colors.primarySoft,
          rippleColor: theme.colors.primarySoft,
          // Match iOS, which labels every tab, not only the selected one.
          labelVisibilityMode: 'labeled' as const,
          iconColor: { default: theme.colors.muted, selected: theme.colors.tint },
          labelStyle: {
            default: { fontFamily: theme.fonts.medium, fontSize: 12, color: theme.colors.muted },
            selected: { fontFamily: theme.fonts.medium, fontSize: 12, color: theme.colors.tint },
          },
        }
      : {};
  return (
    <NativeTabs tintColor={theme.colors.tint} minimizeBehavior="onScrollDown" {...android}>
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }}
          md="grid_view"
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(spaces)">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'rectangle.stack', selected: 'rectangle.stack.fill' }}
          md="stacks"
        />
        <NativeTabs.Trigger.Label>Spaces</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(tidy)">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'photo.stack', selected: 'photo.stack.fill' }}
          md="photo_library"
        />
        <NativeTabs.Trigger.Label>Tidy</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {/* The search role (its own glyph and placement) is iOS-only; Android
          rejects it and needs an explicit icon. */}
      <NativeTabs.Trigger
        name="(search)"
        role={process.env.EXPO_OS === 'ios' ? 'search' : undefined}
      >
        <NativeTabs.Trigger.Icon md="search" />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
