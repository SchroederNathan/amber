import { AnimatedSwitch } from '@/components/ui/animated-switch';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMutation } from 'convex/react';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

// Per-space membership toggles for one item. Every write here is the user's
// hand — `saved` rows only; flipping a space on also overrides a dismissal.
export default function ManageSpacesScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const id = itemId as Id<'items'>;

  const { data: spaces } = useQuery(convexQuery(api.spaces.listSpaces, {}));
  const { data: item } = useQuery(convexQuery(api.items.getItem, { id }));

  const addItemToSpace = useMutation(api.spaces.addItemToSpace);
  const removeItemFromSpace = useMutation(api.spaces.removeItemFromSpace);

  // Local mirror of the memberships so the switches respond instantly; the
  // mutations catch up behind it (Convex confirms in the background).
  const [members, setMembers] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (item && members === null) {
      setMembers(new Set(item.spaces.map((s) => s._id)));
    }
  }, [item, members]);

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
              <AnimatedSwitch
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

const styles = StyleSheet.create((theme) => ({
  content: {
    padding: theme.gap(2.5),
    gap: theme.gap(1.5),
  },
  heading: {
    fontFamily: theme.fonts.display,
    fontSize: 24,
    color: theme.colors.foreground,
  },
  subheading: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.muted,
  },
  spinner: {
    marginVertical: theme.gap(3),
  },
  empty: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
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
    fontFamily: theme.fonts.medium,
    fontSize: 15,
    color: theme.colors.foreground,
  },
}));
