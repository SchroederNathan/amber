import { Share } from 'react-native';

const URL_PATTERN = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+([/?#]\S*)?$/i;

export function isProbablyUrl(text: string) {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  return URL_PATTERN.test(trimmed);
}

export function displayHost(url: string | undefined) {
  if (!url) return '';
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(
      /^www\./,
      '',
    );
  } catch {
    return url;
  }
}

/** Opens the share sheet for a link. React Native's `url` field is iOS-only;
 * Android ignores it and would share nothing, so there the link goes as text. */
export function shareUrl(url: string) {
  return Share.share(process.env.EXPO_OS === 'ios' ? { url } : { message: url });
}
