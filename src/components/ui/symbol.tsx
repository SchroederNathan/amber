import {
  SymbolView as ExpoSymbolView,
  unstable_getMaterialSymbolSourceAsync,
  type AndroidSymbol,
  type SFSymbol,
  type SymbolViewProps,
} from 'expo-symbols';
import bold from 'expo-symbols/androidWeights/bold';
import medium from 'expo-symbols/androidWeights/medium';
import semiBold from 'expo-symbols/androidWeights/semiBold';
import { useEffect, useReducer } from 'react';
import { Platform, type ImageSourcePropType } from 'react-native';

// expo-symbols renders nothing on Android for a bare SF Symbol name; it needs a
// Material Symbol. Every SF Symbol the app uses gets its closest Material glyph
// here, so screens keep passing plain SF names.
const ANDROID_SYMBOLS: Partial<Record<SFSymbol, AndroidSymbol>> = {
  'arrow.triangle.2.circlepath': 'sync',
  'arrow.triangle.2.circlepath.camera': 'cameraswitch',
  'arrow.up': 'arrow_upward',
  'arrow.up.right': 'arrow_outward',
  'arrow.up.right.square': 'open_in_new',
  'arrow.uturn.backward': 'undo',
  bag: 'shopping_bag',
  calendar: 'calendar_today',
  camera: 'photo_camera',
  checkmark: 'check',
  'chevron.left': 'arrow_back',
  'chevron.right': 'chevron_right',
  'doc.on.doc': 'content_copy',
  ellipsis: 'more_horiz',
  envelope: 'mail',
  faceid: 'face',
  link: 'link',
  lock: 'lock',
  magnifyingglass: 'search',
  map: 'map',
  message: 'chat',
  pencil: 'edit',
  person: 'person',
  'person.fill': 'person',
  phone: 'call',
  'photo.on.rectangle': 'photo_library',
  'photo.on.rectangle.angled': 'photo_album',
  plus: 'add',
  'rectangle.portrait.and.arrow.right': 'logout',
  safari: 'explore',
  sparkles: 'auto_awesome',
  'square.and.arrow.up': 'share',
  'square.and.pencil': 'edit_square',
  touchid: 'fingerprint',
  trash: 'delete',
  xmark: 'close',
};

const ANDROID_WEIGHTS = { medium, semibold: semiBold, bold } as const;

type Props = Omit<SymbolViewProps, 'name' | 'weight'> & {
  name: SFSymbol;
  weight?: Extract<SymbolViewProps['weight'], string>;
};

/** `SymbolView` that takes an SF Symbol name and also renders on Android. */
export function SymbolView({ name, weight, ...props }: Props) {
  const androidWeight =
    weight && weight in ANDROID_WEIGHTS
      ? ANDROID_WEIGHTS[weight as keyof typeof ANDROID_WEIGHTS]
      : undefined;
  return (
    <ExpoSymbolView
      {...props}
      name={{ ios: name, android: ANDROID_SYMBOLS[name] }}
      weight={weight && androidWeight ? { ios: weight, android: androidWeight } : weight}
    />
  );
}

// Rendered once per glyph and shared, so a remounted header shows its icons at once.
const toolbarImages = new Map<AndroidSymbol, ImageSourcePropType>();

/**
 * Icon for `Stack.Toolbar` buttons and menus. iOS takes the SF Symbol name; the
 * Android toolbar only draws image sources and renders nothing for a name, so
 * there the Material glyph is drawn to an image first (undefined until ready).
 * `android` overrides the glyph where Android convention differs.
 */
export function useToolbarIcon(
  name: SFSymbol,
  android?: AndroidSymbol,
): SFSymbol | ImageSourcePropType | undefined {
  const glyph = Platform.OS === 'android' ? (android ?? ANDROID_SYMBOLS[name]) : undefined;
  const [, rendered] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    if (!glyph || toolbarImages.has(glyph)) return;
    let live = true;
    // The toolbar tints template images, so the draw color does not matter.
    unstable_getMaterialSymbolSourceAsync(glyph, 24, 'white')
      .then((image) => {
        if (!image) return;
        toolbarImages.set(glyph, image);
        if (live) rendered();
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [glyph]);
  if (Platform.OS !== 'android') return name;
  return glyph ? toolbarImages.get(glyph) : undefined;
}
