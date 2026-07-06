import { AnimatedText } from '@/components/animated-text';
import type { DetailItem } from '@/components/item-detail';
import { formatItemDate } from '@/lib/date';
import { displayHost } from '@/lib/url';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

// The item-detail header: the item's title (morphing via AnimatedText as the
// user swipes between siblings) over the date it belongs to — the original
// camera-roll capture time for imported photos, otherwise when it was saved.
export function ItemHeader({ item }: { item: DetailItem | undefined }) {
  const title =
    item?.title ?? item?.note ?? displayHost(item?.url) ?? 'Untitled';

  const when =
    item?.type === 'image' && item?.capturedAt
      ? item.capturedAt
      : item?._creationTime;

  return (
    <View style={styles.container}>
      {/* Narrower than the default so the morph canvas clears the back button
          on the left and the Share item on the right. */}
      <AnimatedText
        text={title || 'Untitled'}

        height={24}
        style={styles.title}
      />
      {when ? (
        <AnimatedText
          text={formatItemDate(when)}
          height={18}
          style={styles.date}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: 19,
    color: theme.colors.foreground,
  },
  date: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    color: theme.colors.muted,

  },
}));
