import { Box, Column, Image, Row, Spacer, Text } from '@expo/ui/jetpack-compose';
import {
  background,
  cornerRadius,
  fillMaxSize,
  height,
  padding,
  paddingAll,
  size,
  width,
} from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { RecentSavesWidgetProps, WidgetSaveItem } from './recent-saves-widget.types';

// `widgetSize` is the size in dp the launcher draws this instance at. It comes
// from patches/expo-widgets, as does the `widgetURL` tap action below.
type AndroidWidgetEnvironment = WidgetEnvironment & {
  widgetSize?: { width: number; height: number };
};

// The Android (Glance) layout of the "Recent Saves" widget; the iOS layout is
// recent-saves-widget.tsx. Android has one resizable widget instead of iOS's
// small and medium families, so this picks the 2x2 grid or the featured list
// from the size it is drawn at. Everything lives inside the component: the
// `'widget'` directive extracts this one function into the widget JS runtime,
// so module-scope values other than the @expo/ui globals aren't available.
const RecentSavesWidget = (props: RecentSavesWidgetProps, environment: AndroidWidgetEnvironment) => {
  'widget';
  const dark = environment.colorScheme === 'dark';
  // The palette arrives with the snapshot. The fallback is the default Neutral
  // scheme (Tailwind neutral), for a widget placed before the app first syncs.
  const c =
    props.palette?.[dark ? 'dark' : 'light'] ??
    (dark
      ? { background: '#0a0a0a', tile: '#262626', foreground: '#f5f5f5', muted: '#a3a3a3', accent: '#fafafa' }
      : { background: '#fafafa', tile: '#f5f5f5', foreground: '#171717', muted: '#737373', accent: '#171717' });

  // Opens an app deep link on tap, like SwiftUI's widgetURL.
  const openURL = (url: string) => ({ $type: 'widgetURL', url });
  const itemURL = (item: WidgetSaveItem) => `amber:///item/${item.id}`;

  // Material Symbols drawables from assets/widgets/android (see
  // plugins/with-android-widget).
  const kindIcon = (kind: 'image' | 'link' | 'note') =>
    kind === 'link' ? 'amber_widget_link' : kind === 'note' ? 'amber_widget_description' : 'amber_widget_image';

  // Launcher widget corners (system_app_widget_background_radius) are 24dp and
  // content inside is 16dp (system_app_widget_inner_radius), so the content
  // sits 8dp in.
  const pad = 8;
  const gap = 6;
  const widgetWidth = environment.widgetSize?.width ?? 320;
  const widgetHeight = environment.widgetSize?.height ?? 160;
  const innerWidth = widgetWidth - pad * 2;
  const innerHeight = widgetHeight - pad * 2;
  const frame = [fillMaxSize(), background(c.background), cornerRadius(24)];

  const items = props.items ?? [];

  if (items.length === 0) {
    return (
      <Box contentAlignment="center" modifiers={[...frame, paddingAll(16), openURL('amber:///add')]}>
        <Column horizontalAlignment="center">
          <Image source={{ uri: 'amber_widget_inbox' }} tint={c.muted} modifiers={[size(28, 28)]} />
          <Spacer modifiers={[height(8)]} />
          <Text color={c.foreground} maxLines={1} style={{ fontSize: 14, fontWeight: '500', textAlign: 'center' }}>
            Nothing saved yet
          </Text>
          <Spacer modifiers={[height(2)]} />
          <Text color={c.muted} maxLines={2} style={{ fontSize: 12, textAlign: 'center' }}>
            Tap + to save a link, photo, or note
          </Text>
        </Column>
      </Box>
    );
  }

  // Two cells wide (about 180dp or less on phones): the last 4 saves in a 2x2 grid.
  if (widgetWidth < 250) {
    const cellWidth = Math.floor((innerWidth - gap) / 2);
    const cellHeight = Math.floor((innerHeight - gap) / 2);
    // A grid cell: thumbnail if the save has one, otherwise a tile with the
    // type icon and title.
    const tile = (item?: WidgetSaveItem) => {
      if (!item) return <Spacer modifiers={[size(cellWidth, cellHeight)]} />;
      if (item.imageUri) {
        return (
          <Box
            modifiers={[size(cellWidth, cellHeight), background(c.tile), cornerRadius(16), openURL(itemURL(item))]}
          >
            <Image
              source={{ uri: item.imageUri }}
              contentScale="crop"
              contentDescription={item.title}
              modifiers={[size(cellWidth, cellHeight)]}
            />
          </Box>
        );
      }
      return (
        <Box
          modifiers={[
            size(cellWidth, cellHeight),
            background(c.tile),
            cornerRadius(16),
            paddingAll(10),
            openURL(itemURL(item)),
          ]}
        >
          <Column>
            <Image source={{ uri: kindIcon(item.kind) }} tint={c.accent} modifiers={[size(16, 16)]} />
            <Spacer modifiers={[height(4)]} />
            <Text color={c.foreground} maxLines={3} style={{ fontSize: 12, fontWeight: '500' }}>
              {item.title}
            </Text>
          </Column>
        </Box>
      );
    };

    return (
      <Box modifiers={[...frame, paddingAll(pad), openURL('amber:///')]}>
        <Column>
          <Row>
            {tile(items[0])}
            <Spacer modifiers={[width(gap)]} />
            {tile(items[1])}
          </Row>
          <Spacer modifiers={[height(gap)]} />
          <Row>
            {tile(items[2])}
            <Spacer modifiers={[width(gap)]} />
            {tile(items[3])}
          </Row>
        </Column>
      </Box>
    );
  }

  // Wider: the latest save featured on the left, the next ones as rows, as
  // many as the height fits (up to 4).
  const featured = items[0];
  const featuredWidth = Math.round(Math.min(innerHeight * 0.87, innerWidth * 0.4));
  const listGap = 12;
  const listWidth = innerWidth - featuredWidth - listGap;
  const thumb = 32;
  const rowGap = 8;
  const rowCount = Math.max(1, Math.min(4, Math.floor((innerHeight - 4 + rowGap) / (thumb + rowGap))));
  const rest = items.slice(1, 1 + rowCount);

  const row = (item: WidgetSaveItem | undefined, first: boolean) => {
    if (!item) return null;
    return (
      <Column>
        {first ? null : <Spacer modifiers={[height(rowGap)]} />}
        <Row verticalAlignment="center" modifiers={[width(listWidth), openURL(itemURL(item))]}>
          <Box contentAlignment="center" modifiers={[size(thumb, thumb), background(c.tile), cornerRadius(10)]}>
            {item.imageUri ? (
              <Image source={{ uri: item.imageUri }} contentScale="crop" modifiers={[size(thumb, thumb)]} />
            ) : (
              <Image source={{ uri: kindIcon(item.kind) }} tint={c.accent} modifiers={[size(16, 16)]} />
            )}
          </Box>
          <Spacer modifiers={[width(10)]} />
          <Column modifiers={[width(listWidth - thumb - 10)]}>
            <Text color={c.foreground} maxLines={1} style={{ fontSize: 13, fontWeight: '500' }}>
              {item.title}
            </Text>
            <Text color={c.muted} maxLines={1} style={{ fontSize: 11 }}>
              {item.subtitle}
            </Text>
          </Column>
        </Row>
      </Column>
    );
  };

  return (
    <Box modifiers={[...frame, paddingAll(pad), openURL('amber:///')]}>
      <Row>
        <Box
          contentAlignment="bottomStart"
          modifiers={[size(featuredWidth, innerHeight), background(c.tile), cornerRadius(16), openURL(itemURL(featured))]}
        >
          {featured.imageUri ? (
            <Image
              source={{ uri: featured.imageUri }}
              contentScale="crop"
              contentDescription={featured.title}
              modifiers={[size(featuredWidth, innerHeight)]}
            />
          ) : null}
          {featured.imageUri ? (
            <Image
              source={{ uri: 'amber_widget_scrim' }}
              contentScale="fillBounds"
              modifiers={[size(featuredWidth, innerHeight)]}
            />
          ) : null}
          <Column modifiers={[paddingAll(10)]}>
            {!featured.imageUri ? (
              <Image source={{ uri: kindIcon(featured.kind) }} tint={c.accent} modifiers={[size(18, 18)]} />
            ) : null}
            {!featured.imageUri ? <Spacer modifiers={[height(4)]} /> : null}
            <Text
              color={featured.imageUri ? '#ffffff' : c.foreground}
              maxLines={2}
              style={{ fontSize: 13, fontWeight: '500' }}
            >
              {featured.title}
            </Text>
            <Text color={featured.imageUri ? '#ffffffcc' : c.muted} maxLines={1} style={{ fontSize: 11 }}>
              {featured.subtitle}
            </Text>
          </Column>
        </Box>
        <Spacer modifiers={[width(listGap)]} />
        <Column modifiers={[padding(0, 2, 0, 0)]}>
          {row(rest[0], true)}
          {row(rest[1], false)}
          {row(rest[2], false)}
          {row(rest[3], false)}
        </Column>
      </Row>
    </Box>
  );
};

export default createWidget('RecentSaves', RecentSavesWidget, { items: [] });
