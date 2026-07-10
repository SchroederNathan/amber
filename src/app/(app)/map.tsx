import { EmptyState } from '@/components/empty-state';
import { api } from '@convex/_generated/api';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

// The amber accent matches theme.colors.primary (identical in both themes).
const AMBER = '#e6a23c';

type Located = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
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
        })),
    [items],
  );

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

  if (process.env.EXPO_OS === 'ios') {
    return (
      <AppleMaps.View
        style={styles.container}
        cameraPosition={cameraPosition}
        markers={located.map((item) => ({
          id: item.id,
          coordinates: { latitude: item.latitude, longitude: item.longitude },
          title: item.title,
          systemImage: 'photo.fill',
          tintColor: AMBER,
        }))}
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
