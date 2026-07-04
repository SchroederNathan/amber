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
