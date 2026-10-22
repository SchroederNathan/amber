/** Source text Siri can answer questions about. Generated descriptions are not source content. */
export function appIntentContent(item: { content?: string; note?: string }): string | undefined {
  const parts = [...new Set([item.note?.trim(), item.content?.trim()].filter(Boolean))];
  return parts.length > 0 ? parts.join('\n\n') : undefined;
}
