import { HStack, Image, Rectangle, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  aspectRatio,
  clipShape,
  containerBackground,
  containerRelativeFrame,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  resizable,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type WidgetSaveItem = {
  id: string;
  title: string;
  subtitle: string;
  kind: 'image' | 'link' | 'note';
  /** file:// URI of a pre-sized thumbnail inside `widgetsDirectory`. */
  imageUri?: string;
};

export type RecentSavesWidgetProps = {
  items: WidgetSaveItem[];
};

// Everything (palette, helpers) lives inside the component: the `'widget'`
// directive extracts this one function into the widget extension's JS runtime,
// so module-scope values other than the @expo/ui globals aren't available.
const RecentSavesWidget = (props: RecentSavesWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const dark = environment.colorScheme === 'dark';
  // Amber palette, mirrored from src/unistyles.ts.
  const c = dark
    ? {
        background: '#191510',
        tile: '#2c261c',
        foreground: '#f4eddd',
        muted: '#a2977f',
        accent: '#e6a23c',
      }
    : {
        background: '#faf6ee',
        tile: '#f3ecdd',
        foreground: '#2b2418',
        muted: '#8d8271',
        accent: '#e6a23c',
      };

  const kindIcon = (kind: 'image' | 'link' | 'note') =>
    kind === 'link' ? 'link' : kind === 'note' ? 'note.text' : 'photo';

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

  // A grid cell: thumbnail if the save has one, otherwise a warm tile with
  // the type icon and title. Every cell is sized to exactly half the widget
  // minus padding (12pt) and gap (7pt): (side - 12*2 - 7) / 2 — an image's
  // intrinsic size would otherwise skew the HStack split.
  const gridCell = containerRelativeFrame({ axes: 'both', count: 2, spacing: 31 });
  const tile = (item?: WidgetSaveItem) => {
    if (!item) {
      return <Rectangle modifiers={[foregroundStyle('#00000000'), gridCell]} />;
    }
    if (item.imageUri) {
      return (
        <ZStack modifiers={[gridCell, clipShape('roundedRectangle', 12)]}>
          <Rectangle modifiers={[foregroundStyle(c.tile)]} />
          <Image
            uiImage={item.imageUri}
            modifiers={[
              resizable(),
              aspectRatio({ contentMode: 'fill' }),
              frame({ maxWidth: Infinity, maxHeight: Infinity }),
            ]}
          />
        </ZStack>
      );
    }
    return (
      <ZStack alignment="topLeading" modifiers={[gridCell, clipShape('roundedRectangle', 12)]}>
        <Rectangle modifiers={[foregroundStyle(c.tile)]} />
        <VStack
          alignment="leading"
          spacing={3}
          modifiers={[padding({ all: 8 }), frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' })]}
        >
          <Image systemName={kindIcon(item.kind)} size={11} color={c.accent} />
          <Text
            modifiers={[font({ size: 10, weight: 'medium' }), foregroundStyle(c.foreground), lineLimit(3)]}
          >
            {item.title}
          </Text>
        </VStack>
      </ZStack>
    );
  };

  if (environment.widgetFamily === 'systemSmall') {
    // Last 4 saves in a 2x2 grid.
    return (
      <VStack spacing={7} modifiers={[containerBackground(c.background, 'widget'), padding({ all: 12 }), widgetURL('amber:///')]}>
        <HStack spacing={7}>
          {tile(items[0])}
          {tile(items[1])}
        </HStack>
        <HStack spacing={7}>
          {tile(items[2])}
          {tile(items[3])}
        </HStack>
      </VStack>
    );
  }

  // systemMedium: the latest save featured on the left, the next 4 as rows.
  const featured = items[0];
  const rest = items.slice(1, 5);

  const row = (item?: WidgetSaveItem) => {
    if (!item) return null;
    return (
      <HStack spacing={8}>
      {item.imageUri ? (
        <Image
          uiImage={item.imageUri}
          modifiers={[
            resizable(),
            aspectRatio({ contentMode: 'fill' }),
            frame({ width: 26, height: 26 }),
            clipShape('roundedRectangle', 8),
          ]}
        />
      ) : (
        <ZStack modifiers={[frame({ width: 26, height: 26 }), clipShape('roundedRectangle', 8)]}>
          <Rectangle modifiers={[foregroundStyle(c.tile)]} />
          <Image systemName={kindIcon(item.kind)} size={11} color={c.accent} />
        </ZStack>
      )}
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
    <HStack spacing={12} modifiers={[containerBackground(c.background, 'widget'), padding({ all: 13 }), widgetURL('amber:///')]}>
      <ZStack
        alignment="bottomLeading"
        modifiers={[frame({ width: 112, maxHeight: Infinity }), clipShape('roundedRectangle', 14)]}
      >
        {featured.imageUri ? (
          <Image
            uiImage={featured.imageUri}
            modifiers={[resizable(), aspectRatio({ contentMode: 'fill' }), frame({ width: 112, maxHeight: Infinity })]}
          />
        ) : (
          <Rectangle modifiers={[foregroundStyle(c.tile)]} />
        )}
        {featured.imageUri ? (
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
        ) : null}
        <VStack alignment="leading" spacing={1} modifiers={[padding({ all: 8 })]}>
          {!featured.imageUri ? <Image systemName={kindIcon(featured.kind)} size={12} color={c.accent} /> : null}
          <Text
            modifiers={[
              font({ size: 11, weight: 'semibold' }),
              foregroundStyle(featured.imageUri ? '#ffffff' : c.foreground),
              lineLimit(2),
            ]}
          >
            {featured.title}
          </Text>
          <Text
            modifiers={[
              font({ size: 9 }),
              foregroundStyle(featured.imageUri ? '#ffffffcc' : c.muted),
              lineLimit(1),
            ]}
          >
            {featured.subtitle}
          </Text>
        </VStack>
      </ZStack>
      <VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
        {row(rest[0])}
        {row(rest[1])}
        {row(rest[2])}
        {row(rest[3])}
        <Spacer />
      </VStack>
    </HStack>
  );
};

export default createWidget('RecentSaves', RecentSavesWidget);
