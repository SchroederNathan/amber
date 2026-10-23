import { requireOptionalNativeModule } from 'expo';

type SetupModule = {
  setCaptureCredentials(siteUrl: string, token: string, userId: string): Promise<void>;
  clearCaptureCredentials(): Promise<void>;
  hasCaptureCredentials(userId: string): Promise<boolean>;
  /** Mirrors the `item` catalog into Spotlight; resolves with the indexed count. */
  indexItemsInSpotlight(): Promise<number>;
  clearSpotlight(): Promise<void>;
};

// Null on Android, web, and dev clients built before the intents existed.
export const appIntentsSetup = requireOptionalNativeModule<SetupModule>('AppIntentsSetup');
