import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMutation } from 'convex/react';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Switch, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

// Per-space membership toggles for one item. Every write here is the user's
// hand — `saved` rows only; flipping a space on also overrides a dismissal.
export default function ManageSpacesScreen() {
  const { theme } = useUnistyles();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const id = itemId as Id<'items'>;

  const { data: spaces } = useQuery(convexQuery(api.spaces.listSpaces, {}));
  const { data: item } = useQuery(convexQuery(api.items.getItem, { id }));

  const addItemToSpace = useMutation(api.spaces.addItemToSpace);
  const removeItemFromSpace = useMutation(api.spaces.removeItemFromSpace);

  // Local mirror of the memberships so the switches respond instantly; the
  // mutations catch up behind it (Convex confirms in the background).
  const [members, setMembers] = useState<Set<string> | null>(null);
  if (item && members === null) {
    setMembers(new Set(item.spaces.map((s) => s._id)));
  }

  const toggle = (spaceId: Id<'spaces'>, next: boolean) => {
    setMembers((current) => {
      const set = new Set(current);
      if (next) set.add(spaceId);
      else set.delete(spaceId);
      return set;
    });
    if (next) addItemToSpace({ itemId: id, spaceId });
    else removeItemFromSpace({ itemId: id, spaceId });
  };

  const loading = spaces === undefined || members === null;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Spaces</Text>
      <Text style={styles.subheading}>Choose where this save lives.</Text>

      {loading ? (
        <ActivityIndicator style={styles.spinner} />
      ) : spaces.length === 0 ? (
        <Text style={styles.empty}>
          No spaces yet — create one from the Spaces tab.
        </Text>
      ) : (
        <View style={styles.list}>
          {spaces.map((space) => (
            <View key={space._id} style={styles.row}>
              <Text style={styles.rowLabel} numberOfLines={1}>
                {space.name}
              </Text>
              <Switch
                accessibilityLabel={space.name}
                trackColor={{ true: theme.colors.toggle }}
                // Android otherwise paints the thumb in the system accent.
                thumbColor={process.env.EXPO_OS === 'android' ? theme.colors.toggleThumb : undefined}
                value={members.has(space._id)}
                onValueChange={(next) => toggle(space._id, next)}
              />
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  content: {
    padding: theme.gap(2.5),
    // Android sheets draw edge-to-edge behind the navigation bar.
    paddingBottom: theme.gap(2.5) + (process.env.EXPO_OS === 'android' ? rt.insets.bottom : 0),
    gap: theme.gap(1.5),
  },
  heading: {
    ...theme.type.sheetTitle,
    color: theme.colors.foreground,
  },
  subheading: {
    ...theme.type.footnote,
    lineHeight: 20,
    color: theme.colors.muted,
  },
  spinner: {
    marginVertical: theme.gap(3),
  },
  empty: {
    ...theme.type.footnote,
    color: theme.colors.muted,
    marginVertical: theme.gap(2),
  },
  list: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.gap(1.5),
    paddingVertical: theme.gap(1.5),
    paddingHorizontal: theme.gap(1.5),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowLabel: {
    flex: 1,
    ...theme.type.subheadLabel,
    color: theme.colors.foreground,
  },
}));
