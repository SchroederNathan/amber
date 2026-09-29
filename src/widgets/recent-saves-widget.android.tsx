import { Box, Column, Image, Row, Spacer, Text } from '@expo/ui/jetpack-compose';
import {
  background,
  cornerRadius,
  fillMaxSize,
  height,
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
// recent-saves-widget.tsx and uses the same sizing rules. Android has one
// resizable widget instead of iOS's small and medium families, so this picks
// the masonry grid or the featured list from the size it is drawn at.
// Everything lives inside the component: the `'widget'` directive extracts
// this one function into the widget JS runtime, so module-scope values other
// than the @expo/ui globals aren't available.
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

  // Images keep their own shape, like cards in the app feed: the layout sizes
  // each frame to the image's aspect ratio instead of cropping the image to
  // the frame. Only extreme shapes are clamped (same bounds as the feed).
  const ratioOf = (item: WidgetSaveItem) => {
    const r = item.aspectRatio;
    const value = r && r > 0 && Number.isFinite(r) ? r : item.kind === 'link' ? 1.91 : 1;
    return Math.min(Math.max(value, 0.5), 2);
  };

  // A photo drawn into a frame of its own aspect ratio, so `crop` cuts nothing.
  const photo = (item: WidgetSaveItem, w: number, h: number, radius: number) => (
    <Box modifiers={radius > 0 ? [size(w, h), cornerRadius(radius)] : [size(w, h)]}>
      <Image
        source={{ uri: item.imageUri ?? '' }}
        contentScale="crop"
        contentDescription={item.title}
        modifiers={[size(w, h)]}
      />
    </Box>
  );

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

  // Two cells wide (about 180dp or less on phones): a two-column masonry of the
  // latest saves, like the feed. Each photo tile takes its own aspect ratio;
  // note and text tiles absorb the spare height so both columns end flush with
  // the bottom edge.
  if (widgetWidth < 250) {
    const minText = 44;
    // One or two saves get the full width instead of a half-empty grid.
    const columnCount = items.length <= 2 ? 1 : 2;
    const colWidth = (innerWidth - gap * (columnCount - 1)) / columnCount;
    const natural = (item: WidgetSaveItem) => (item.imageUri ? colWidth / ratioOf(item) : colWidth * 0.8);

    // Fill the shorter column until both reach the bottom.
    const cols: WidgetSaveItem[][] = columnCount === 1 ? [[]] : [[], []];
    const used = columnCount === 1 ? [0] : [0, 0];
    for (const item of items) {
      const col = used.length === 1 || used[0] <= used[1] ? 0 : 1;
      if (used[col] >= innerHeight || cols[col].length === 4) break;
      used[col] += (cols[col].length > 0 ? gap : 0) + natural(item);
      cols[col].push(item);
    }

    // Keep or drop the tile that crosses the bottom edge, whichever needs the
    // photos scaled less to fill the column exactly (1 = exact aspect ratio).
    const fitColumn = (tiles: WidgetSaveItem[]) => {
      let best: { cost: number; tiles: WidgetSaveItem[]; heights: number[]; width: number } | null = null;
      for (let count = tiles.length; count >= Math.max(1, tiles.length - 1); count--) {
        const kept = tiles.slice(0, count);
        const free = innerHeight - gap * (count - 1);
        const photoHeight = kept.reduce((sum, t) => sum + (t.imageUri ? natural(t) : 0), 0);
        const texts = kept.filter((t) => !t.imageUri).length;
        let scale = 1;
        let textHeight = 0;
        if (texts > 0) {
          textHeight = (free - photoHeight) / texts;
          if (textHeight < minText) {
            textHeight = minText;
            scale = photoHeight > 0 ? (free - texts * minText) / photoHeight : 1;
          }
        } else {
          scale = free / photoHeight;
        }
        if (scale <= 0) continue;
        const cost = Math.abs(Math.log(scale));
        // Photos that would be stretched more than 25% taller keep their shape
        // and the column ends short. Photos that would be squashed shrink in
        // width too, so they keep their shape and still fill the height. Both
        // only happen with very few saves.
        scale = Math.min(scale, 1.25);
        const width = scale < 0.8 ? colWidth * scale : colWidth;
        if (!best || cost < best.cost) {
          best = { cost, tiles: kept, width, heights: kept.map((t) => (t.imageUri ? natural(t) * scale : textHeight)) };
        }
      }
      return best ?? { cost: 0, tiles: [], heights: [], width: colWidth };
    };

    const tile = (column: { tiles: WidgetSaveItem[]; heights: number[]; width: number }, index: number) => {
      const item = column.tiles[index];
      if (!item) return null;
      const tileHeight = column.heights[index];
      const gapAbove = index > 0 ? <Spacer modifiers={[height(gap)]} /> : null;
      if (item.imageUri) {
        return (
          <Column>
            {gapAbove}
            <Box contentAlignment="center" modifiers={[size(colWidth, tileHeight), openURL(itemURL(item))]}>
              {photo(item, column.width, tileHeight, 16)}
            </Box>
          </Column>
        );
      }
      const lines = Math.max(1, Math.min(4, Math.floor((tileHeight - 20 - 20) / 16)));
      return (
        <Column>
          {gapAbove}
          <Box
            modifiers={[size(colWidth, tileHeight), background(c.tile), cornerRadius(16), paddingAll(10), openURL(itemURL(item))]}
          >
            <Column>
              <Image source={{ uri: kindIcon(item.kind) }} tint={c.accent} modifiers={[size(16, 16)]} />
              <Spacer modifiers={[height(4)]} />
              <Text color={c.foreground} maxLines={lines} style={{ fontSize: 12, fontWeight: '500' }}>
                {item.title}
              </Text>
            </Column>
          </Box>
        </Column>
      );
    };

    const column = (tiles: WidgetSaveItem[] | undefined) => {
      if (!tiles) return null;
      const fitted = fitColumn(tiles);
      return (
        <Box
          contentAlignment={fitted.tiles.length === 1 ? 'center' : 'topStart'}
          modifiers={[size(colWidth, innerHeight)]}
        >
          <Column>
            {tile(fitted, 0)}
            {tile(fitted, 1)}
            {tile(fitted, 2)}
            {tile(fitted, 3)}
          </Column>
        </Box>
      );
    };

    return (
      <Box modifiers={[...frame, paddingAll(pad), openURL('amber:///')]}>
        <Row>
          {column(cols[0])}
          {cols.length > 1 ? <Spacer modifiers={[width(gap)]} /> : null}
          {column(cols[1])}
        </Row>
      </Box>
    );
  }

  // Wider: the latest save featured on the left, the next ones as rows that
  // split the full height between them.
  const featured = items[0];
  const listGap = 12;

  // The featured card follows the image's shape. Tall and square images fill
  // the card height with the title over a scrim; wide ones sit on top of the
  // card at full width with the title below, so neither is cropped.
  const titleLines = innerHeight >= 140 ? 2 : 1;
  const textBlock = 20 + 17 * titleLines + 15;
  const maxCardWidth = innerWidth * 0.46;
  const featuredRatio = ratioOf(featured);
  const overlay = !!featured.imageUri && innerHeight * featuredRatio <= maxCardWidth;
  const cardWidth = Math.round(
    !featured.imageUri
      ? Math.min(innerHeight, innerWidth * 0.4)
      : overlay
        ? Math.max(innerHeight * featuredRatio, innerHeight * 0.6)
        : Math.min(maxCardWidth, (innerHeight - textBlock) * featuredRatio),
  );
  const imageHeight = overlay ? innerHeight : cardWidth / featuredRatio;

  const featuredText = (onImage: boolean) => (
    <Column modifiers={[paddingAll(10)]}>
      {!featured.imageUri ? (
        <Image source={{ uri: kindIcon(featured.kind) }} tint={c.accent} modifiers={[size(18, 18)]} />
      ) : null}
      {!featured.imageUri ? <Spacer modifiers={[height(4)]} /> : null}
      <Text color={onImage ? '#ffffff' : c.foreground} maxLines={titleLines} style={{ fontSize: 13, fontWeight: '500' }}>
        {featured.title}
      </Text>
      <Text color={onImage ? '#ffffffcc' : c.muted} maxLines={1} style={{ fontSize: 11 }}>
        {featured.subtitle}
      </Text>
    </Column>
  );

  const featuredCard = overlay ? (
    <Box
      contentAlignment="bottomStart"
      modifiers={[size(cardWidth, innerHeight), background(c.tile), cornerRadius(16), openURL(itemURL(featured))]}
    >
      {photo(featured, cardWidth, innerHeight, 0)}
      <Image
        source={{ uri: 'amber_widget_scrim' }}
        contentScale="fillBounds"
        modifiers={[size(cardWidth, innerHeight)]}
      />
      {featuredText(true)}
    </Box>
  ) : (
    <Box modifiers={[size(cardWidth, innerHeight), background(c.tile), cornerRadius(16), openURL(itemURL(featured))]}>
      <Column>
        {featured.imageUri ? photo(featured, cardWidth, imageHeight, 0) : null}
        {featuredText(false)}
      </Column>
    </Box>
  );

  // Rows share the full height, so the first lines up with the card's top and
  // the last with its bottom.
  const listWidth = innerWidth - cardWidth - listGap;
  const rowGap = 8;
  const slots = Math.max(1, Math.min(4, Math.floor((innerHeight + rowGap) / (36 + rowGap))));
  const rowHeight = (innerHeight - rowGap * (slots - 1)) / slots;
  const rest = items.slice(1, 1 + slots);
  // Thumbnails keep their shape inside a fixed slot so the titles line up.
  const thumbHeight = Math.min(rowHeight, 44, (listWidth * 0.32) / 1.4);
  const thumbWidth = Math.round(thumbHeight * 1.4);

  const row = (item: WidgetSaveItem | undefined, first: boolean) => {
    if (!item) return null;
    const r = ratioOf(item);
    const w = Math.min(thumbWidth, thumbHeight * r);
    const h = w / r;
    return (
      <Column>
        {first ? null : <Spacer modifiers={[height(rowGap)]} />}
        <Row verticalAlignment="center" modifiers={[size(listWidth, rowHeight), openURL(itemURL(item))]}>
          <Box contentAlignment="center" modifiers={[size(thumbWidth, rowHeight)]}>
            {item.imageUri ? (
              photo(item, w, h, Math.min(10, h / 4))
            ) : (
              <Box
                contentAlignment="center"
                modifiers={[size(thumbHeight, thumbHeight), background(c.tile), cornerRadius(10)]}
              >
                <Image source={{ uri: kindIcon(item.kind) }} tint={c.accent} modifiers={[size(16, 16)]} />
              </Box>
            )}
          </Box>
          <Spacer modifiers={[width(10)]} />
          <Column modifiers={[width(listWidth - thumbWidth - 10)]}>
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
        {featuredCard}
        <Spacer modifiers={[width(listGap)]} />
        <Column>
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
