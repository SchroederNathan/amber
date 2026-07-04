import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { DynamicColorIOS, type ColorValue } from 'react-native';

const amberTint: ColorValue =
  process.env.EXPO_OS === 'ios'
    ? DynamicColorIOS({ light: '#c98a24', dark: '#e6a23c' })
    : '#e6a23c';

export default function TabsLayout() {
  return (
    <NativeTabs tintColor={amberTint} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }}
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(spaces)">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'rectangle.stack', selected: 'rectangle.stack.fill' }}
        />
        <NativeTabs.Trigger.Label>Spaces</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(search)" role="search">
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
