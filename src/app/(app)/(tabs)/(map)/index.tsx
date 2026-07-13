import { EmptyState } from '@/components/empty-state';
import { api } from '@convex/_generated/api';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { ClipOp, Skia } from '@shopify/react-native-skia';
import type { SharedRefType } from 'expo';
import { Image } from 'expo-image';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

// The amber accent matches theme.colors.primary (identical in both themes).
const AMBER = '#e6a23c';

// Apple Maps stretches an annotation icon into a fixed 50x50pt frame, so
// thumbnails are pre-composited to a square: the photo aspect-fit (contained)
// on a transparent canvas and clipped to rounded corners. 150px = 50pt @3x.
const THUMB_SIZE = 150;
const THUMB_RADIUS = 24;

async function makeThumb(
  url: string,
): Promise<SharedRefType<'image'> | null> {
  const data = await Skia.Data.fromURI(url);
  const source = Skia.Image.MakeImageFromEncoded(data);
  if (!source) return null;

  const scale = Math.min(
    THUMB_SIZE / source.width(),
    THUMB_SIZE / source.height(),
  );
  const w = source.width() * scale;
  const h = source.height() * scale;
  const x = (THUMB_SIZE - w) / 2;
  const y = (THUMB_SIZE - h) / 2;

  const surface = Skia.Surface.MakeOffscreen(THUMB_SIZE, THUMB_SIZE);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  canvas.clipRRect(
    Skia.RRectXY(Skia.XYWHRect(x, y, w, h), THUMB_RADIUS, THUMB_RADIUS),
    ClipOp.Intersect,
    true,
  );
  const paint = Skia.Paint();
  canvas.drawImageRect(
    source,
    Skia.XYWHRect(0, 0, source.width(), source.height()),
    Skia.XYWHRect(x, y, w, h),
    paint,
  );
  const base64 = surface.makeImageSnapshot().encodeToBase64();
  return Image.loadAsync({ uri: `data:image/png;base64,${base64}` });
}

type Located = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
};

/** Frames every marker: bounding-box midpoint, zoomed so the widest span
 * fits. `log2(360 / span)` is the standard web-mercator zoom for a span in
 * degrees; the -0.5 leaves breathing room at the edges. */
function fitCamera(items: Located[]) {
  const lats = items.map((i) => i.latitude);
  const lons = items.map((i) => i.longitude);
  const latMin = Math.min(...lats);
  const latMax = Math.max(...lats);
  const lonMin = Math.min(...lons);
  const lonMax = Math.max(...lons);
  const span = Math.max(latMax - latMin, lonMax - lonMin);
  const zoom =
    span === 0 ? 13 : Math.min(13, Math.max(2, Math.log2(360 / span) - 0.5));
  return {
    coordinates: {
      latitude: (latMin + latMax) / 2,
      longitude: (lonMin + lonMax) / 2,
    },
    zoom,
  };
}

export default function MapScreen() {
  const router = useRouter();
  const { data: items } = useQuery(convexQuery(api.items.listItems, {}));

  const located = useMemo(
    () =>
      (items ?? [])
        .filter((i) => i.latitude !== undefined && i.longitude !== undefined)
        .map((i) => ({
          id: i._id,
          title: i.title ?? 'Saved photo',
          latitude: i.latitude!,
          longitude: i.longitude!,
          imageUrl: i.imageUrl,
        })),
    [items],
  );

  // Marker icons must be native image refs, not sources, so each item's photo
  // is loaded imperatively (useImage is a hook and can't run per-item).
  const requested = useRef(new Set<string>());
  const [thumbs, setThumbs] = useState<
    Record<string, SharedRefType<'image'>>
  >({});

  useEffect(() => {
    for (const item of located) {
      if (!item.imageUrl || requested.current.has(item.id)) continue;
      requested.current.add(item.id);
      makeThumb(item.imageUrl)
        .then((ref) => {
          if (ref) setThumbs((prev) => ({ ...prev, [item.id]: ref }));
        })
        .catch(() => requested.current.delete(item.id));
    }
  }, [located]);

  const cameraPosition = useMemo(
    () => (located.length > 0 ? fitCamera(located) : undefined),
    [located],
  );

  if (items === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  if (located.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Nothing on the map yet"
          message={
            'Photos you save keep the place they were taken.\nNew saves with location data will show up here.'
          }
        />
      </View>
    );
  }

  const openItem = (id: string | undefined) => {
    if (!id) return;
    router.push({ pathname: '/item/[id]', params: { id } });
  };

  const withThumb = located.filter((item) => thumbs[item.id]);
  const withoutThumb = located.filter((item) => !thumbs[item.id]);

  if (process.env.EXPO_OS === 'ios') {
    return (
      <AppleMaps.View
        style={styles.container}
        cameraPosition={cameraPosition}
        annotations={withThumb.map((item) => ({
          id: item.id,
          coordinates: { latitude: item.latitude, longitude: item.longitude },
          icon: thumbs[item.id],
        }))}
        markers={withoutThumb.map((item) => ({
          id: item.id,
          coordinates: { latitude: item.latitude, longitude: item.longitude },
          title: item.title,
          systemImage: 'photo.fill',
          tintColor: AMBER,
        }))}
        onAnnotationClick={(annotation) => openItem(annotation.id)}
        onMarkerClick={(marker) => openItem(marker.id)}
      />
    );
  }

  return (
    <GoogleMaps.View
      style={styles.container}
      cameraPosition={cameraPosition}
      markers={located.map((item) => ({
        id: item.id,
        coordinates: { latitude: item.latitude, longitude: item.longitude },
        title: item.title,
        icon: thumbs[item.id],
        anchor: thumbs[item.id] ? { x: 0.5, y: 0.5 } : undefined,
      }))}
      onMarkerClick={(marker) => openItem(marker.id)}
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
}));
