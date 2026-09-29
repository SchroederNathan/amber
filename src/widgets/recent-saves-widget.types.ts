// Shared by the iOS (SwiftUI) and Android (Glance) layouts of the widget, and
// by the app-side sync in lib/widget-sync.
export type WidgetSaveItem = {
  id: string;
  title: string;
  subtitle: string;
  kind: 'image' | 'link' | 'note';
  /** file:// URI of a pre-sized thumbnail inside `widgetsDirectory`. */
  imageUri?: string;
  /** Width / height of the image, so the layout can show it uncropped. */
  aspectRatio?: number;
};

export type WidgetColors = {
  background: string;
  tile: string;
  foreground: string;
  muted: string;
  accent: string;
};

/** The app's active color scheme, sent with every snapshot (see lib/widget-sync). */
export type WidgetPalette = { light: WidgetColors; dark: WidgetColors };

export type RecentSavesWidgetProps = {
  items: WidgetSaveItem[];
  palette?: WidgetPalette;
};
