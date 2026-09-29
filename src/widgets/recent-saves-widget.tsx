import { HStack, Image, Rectangle, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  aspectRatio,
  clipShape,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  resizable,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { RecentSavesWidgetProps, WidgetSaveItem } from './recent-saves-widget.types';

// `widgetSize` is the size in points WidgetKit draws this instance at. It comes
// from patches/expo-widgets, like the Android one.
type IOSWidgetEnvironment = WidgetEnvironment & {
  widgetSize?: { width: number; height: number };
};

// The iOS (SwiftUI) layout of the "Recent Saves" widget; the Android layout is
// recent-saves-widget.android.tsx and uses the same sizing rules. Everything
// (palette, helpers) lives inside the component: the `'widget'` directive
// extracts this one function into the widget extension's JS runtime, so
// module-scope values other than the @expo/ui globals aren't available.
const RecentSavesWidget = (props: RecentSavesWidgetProps, environment: IOSWidgetEnvironment) => {
  'widget';
  const dark = environment.colorScheme === 'dark';
  // The palette arrives with the snapshot. The fallback is the default Neutral
  // scheme (Tailwind neutral), for a widget placed before the app first syncs.
  const c =
    props.palette?.[dark ? 'dark' : 'light'] ??
    (dark
      ? { background: '#0a0a0a', tile: '#262626', foreground: '#f5f5f5', muted: '#a3a3a3', accent: '#fafafa' }
      : { background: '#fafafa', tile: '#f5f5f5', foreground: '#171717', muted: '#737373', accent: '#171717' });

  const kindIcon = (kind: 'image' | 'link' | 'note') =>
    kind === 'link' ? 'link' : kind === 'note' ? 'note.text' : 'photo';

  // Images keep their own shape, like cards in the app feed: the layout sizes
  // each frame to the image's aspect ratio instead of cropping the image to
  // the frame. Only extreme shapes are clamped (same bounds as the feed).
  const ratioOf = (item: WidgetSaveItem) => {
    const r = item.aspectRatio;
    const value = r && r > 0 && Number.isFinite(r) ? r : item.kind === 'link' ? 1.91 : 1;
    return Math.min(Math.max(value, 0.5), 2);
  };

  // A photo drawn into a frame of its own aspect ratio, so `fill` crops nothing.
  const photo = (item: WidgetSaveItem, width: number, height: number, radius: number) => (
    <Image
      uiImage={item.imageUri}
      modifiers={[
        resizable(),
        aspectRatio({ contentMode: 'fill' }),
        frame({ width, height }),
        clipShape('roundedRectangle', radius),
      ]}
    />
  );

  const items = props.items ?? [];

  if (items.length === 0) {
    return (
      <VStack spacing={6} modifiers={[containerBackground(c.background, 'widget'), widgetURL('amber:///add')]}>
        <Image systemName="tray" size={22} color={c.muted} />
        <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(c.foreground)]}>
          Nothing saved yet
        </Text>
        <Text modifiers={[font({ size: 10 }), foregroundStyle(c.muted)]}>
          Tap + to save a link, photo, or note
        </Text>
      </VStack>
    );
  }

  const small = environment.widgetFamily === 'systemSmall';
  // Fallbacks are the 6.1" iPhone sizes, for a build without the size patch.
  const widgetWidth = environment.widgetSize?.width ?? (small ? 158 : 338);
  const widgetHeight = environment.widgetSize?.height ?? 158;

  if (small) {
    // A two-column masonry of the latest saves, like the feed. Each photo tile
    // takes its own aspect ratio; note and text tiles absorb the spare height
    // so both columns end flush with the bottom edge.
    const pad = 12;
    const gap = 7;
    const innerWidth = widgetWidth - pad * 2;
    const availHeight = widgetHeight - pad * 2;
    const minText = 34;
    // One or two saves get the full width instead of a half-empty grid.
    const columnCount = items.length <= 2 ? 1 : 2;
    const colWidth = (innerWidth - gap * (columnCount - 1)) / columnCount;
    const natural = (item: WidgetSaveItem) => (item.imageUri ? colWidth / ratioOf(item) : colWidth * 0.8);

    // Fill the shorter column until both reach the bottom.
    const cols: WidgetSaveItem[][] = columnCount === 1 ? [[]] : [[], []];
    const used = columnCount === 1 ? [0] : [0, 0];
    for (const item of items) {
      const col = used.length === 1 || used[0] <= used[1] ? 0 : 1;
      if (used[col] >= availHeight || cols[col].length === 4) break;
      used[col] += (cols[col].length > 0 ? gap : 0) + natural(item);
      cols[col].push(item);
    }

    // Keep or drop the tile that crosses the bottom edge, whichever needs the
    // photos scaled less to fill the column exactly (1 = exact aspect ratio).
    const fitColumn = (tiles: WidgetSaveItem[]) => {
      let best: { cost: number; tiles: WidgetSaveItem[]; heights: number[]; width: number } | null = null;
      for (let count = tiles.length; count >= Math.max(1, tiles.length - 1); count--) {
        const kept = tiles.slice(0, count);
        const free = availHeight - gap * (count - 1);
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
      const height = column.heights[index];
      if (item.imageUri) return photo(item, column.width, height, 12);
      const lines = Math.max(1, Math.min(4, Math.floor((height - 16 - 15) / 13)));
      return (
        <ZStack alignment="topLeading" modifiers={[frame({ width: colWidth, height }), clipShape('roundedRectangle', 12)]}>
          <Rectangle modifiers={[foregroundStyle(c.tile)]} />
          <VStack
            alignment="leading"
            spacing={3}
            modifiers={[padding({ all: 8 }), frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' })]}
          >
            <Image systemName={kindIcon(item.kind)} size={11} color={c.accent} />
            <Text modifiers={[font({ size: 10, weight: 'medium' }), foregroundStyle(c.foreground), lineLimit(lines)]}>
              {item.title}
            </Text>
          </VStack>
        </ZStack>
      );
    };

    const column = (tiles: WidgetSaveItem[] | undefined) => {
      if (!tiles) return null;
      const fitted = fitColumn(tiles);
      return (
        <VStack
          spacing={gap}
          modifiers={[frame({ width: colWidth, height: availHeight, alignment: fitted.tiles.length === 1 ? 'center' : 'top' })]}
        >
          {tile(fitted, 0)}
          {tile(fitted, 1)}
          {tile(fitted, 2)}
          {tile(fitted, 3)}
        </VStack>
      );
    };

    return (
      <HStack
        spacing={gap}
        alignment="top"
        modifiers={[containerBackground(c.background, 'widget'), padding({ all: pad }), widgetURL('amber:///')]}
      >
        {column(cols[0])}
        {column(cols[1])}
      </HStack>
    );
  }

  // systemMedium: the latest save featured on the left, the next ones as rows
  // that split the full height between them.
  const pad = 13;
  const listGap = 12;
  const innerWidth = widgetWidth - pad * 2;
  const innerHeight = widgetHeight - pad * 2;
  const featured = items[0];

  // The featured card follows the image's shape. Tall and square images fill
  // the card height with the title over a scrim; wide ones sit on top of the
  // card at full width with the title below, so neither is cropped.
  const maxCardWidth = innerWidth * 0.46;
  const textBlock = 54;
  const featuredRatio = ratioOf(featured);
  const overlay = !!featured.imageUri && innerHeight * featuredRatio <= maxCardWidth;
  const cardWidth = !featured.imageUri
    ? innerWidth * 0.36
    : overlay
      ? Math.max(innerHeight * featuredRatio, innerHeight * 0.6)
      : Math.min(maxCardWidth, (innerHeight - textBlock) * featuredRatio);
  const imageHeight = overlay ? innerHeight : cardWidth / featuredRatio;

  const featuredText = (onImage: boolean) => (
    <VStack alignment="leading" spacing={1} modifiers={[padding({ all: 8 })]}>
      {!featured.imageUri ? <Image systemName={kindIcon(featured.kind)} size={12} color={c.accent} /> : null}
      <Text
        modifiers={[
          font({ size: 11, weight: 'semibold' }),
          foregroundStyle(onImage ? '#ffffff' : c.foreground),
          lineLimit(2),
        ]}
      >
        {featured.title}
      </Text>
      <Text modifiers={[font({ size: 9 }), foregroundStyle(onImage ? '#ffffffcc' : c.muted), lineLimit(1)]}>
        {featured.subtitle}
      </Text>
    </VStack>
  );

  const featuredCard = overlay ? (
    <ZStack
      alignment="bottomLeading"
      modifiers={[frame({ width: cardWidth, height: innerHeight }), clipShape('roundedRectangle', 14)]}
    >
      {photo(featured, cardWidth, innerHeight, 0)}
      <Rectangle
        modifiers={[
          foregroundStyle({
            type: 'linearGradient',
            colors: ['#00000000', '#000000A6'],
            startPoint: { x: 0.5, y: 0.35 },
            endPoint: { x: 0.5, y: 1 },
          }),
        ]}
      />
      {featuredText(true)}
    </ZStack>
  ) : (
    <ZStack
      alignment="topLeading"
      modifiers={[frame({ width: cardWidth, height: innerHeight }), clipShape('roundedRectangle', 14)]}
    >
      <Rectangle modifiers={[foregroundStyle(c.tile)]} />
      <VStack alignment="leading" spacing={0} modifiers={[frame({ width: cardWidth, height: innerHeight, alignment: 'topLeading' })]}>
        {featured.imageUri ? photo(featured, cardWidth, imageHeight, 0) : null}
        {featuredText(false)}
      </VStack>
    </ZStack>
  );

  // Rows share the full height, so the first lines up with the card's top and
  // the last with its bottom.
  const listWidth = innerWidth - cardWidth - listGap;
  const rowGap = 6;
  const slots = Math.max(1, Math.min(4, Math.floor((innerHeight + rowGap) / (26 + rowGap))));
  const rowHeight = (innerHeight - rowGap * (slots - 1)) / slots;
  const rest = items.slice(1, 1 + slots);
  // Thumbnails keep their shape inside a fixed slot so the titles line up.
  const thumbHeight = Math.min(rowHeight, 40, (listWidth * 0.32) / 1.4);
  const thumbWidth = Math.round(thumbHeight * 1.4);

  const row = (item?: WidgetSaveItem) => {
    if (!item) return null;
    const r = ratioOf(item);
    const w = Math.min(thumbWidth, thumbHeight * r);
    const h = w / r;
    return (
      <HStack spacing={8} modifiers={[frame({ width: listWidth, height: rowHeight })]}>
        <ZStack modifiers={[frame({ width: thumbWidth, height: rowHeight })]}>
          {item.imageUri ? (
            photo(item, w, h, Math.min(8, h / 4))
          ) : (
            <ZStack modifiers={[frame({ width: thumbHeight, height: thumbHeight }), clipShape('roundedRectangle', 8)]}>
              <Rectangle modifiers={[foregroundStyle(c.tile)]} />
              <Image systemName={kindIcon(item.kind)} size={11} color={c.accent} />
            </ZStack>
          )}
        </ZStack>
        <VStack alignment="leading" spacing={1} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
          <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle(c.foreground), lineLimit(1)]}>
            {item.title}
          </Text>
          <Text modifiers={[font({ size: 9 }), foregroundStyle(c.muted), lineLimit(1)]}>
            {item.subtitle}
          </Text>
        </VStack>
      </HStack>
    );
  };

  return (
    <HStack
      spacing={listGap}
      alignment="top"
      modifiers={[containerBackground(c.background, 'widget'), padding({ all: pad }), widgetURL('amber:///')]}
    >
      {featuredCard}
      <VStack
        alignment="leading"
        spacing={rowGap}
        modifiers={[frame({ width: listWidth, height: innerHeight, alignment: 'topLeading' })]}
      >
        {row(rest[0])}
        {row(rest[1])}
        {row(rest[2])}
        {row(rest[3])}
      </VStack>
    </HStack>
  );
};

export default createWidget('RecentSaves', RecentSavesWidget);
