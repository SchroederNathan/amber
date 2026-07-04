import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export type LiftResult = {
  /** file:// path to the generated transparent PNG sticker. */
  uri: string;
  width: number;
  height: number;
  /** false when Vision found no foreground subject in the photo. */
  hasSubject: boolean;
};

type SubjectLiftNativeModule = {
  liftSubject: (uri: string) => Promise<LiftResult>;
};

const nativeModule = requireOptionalNativeModule<SubjectLiftNativeModule>('SubjectLift');

function iosMajorVersion(): number {
  const major = parseInt(String(Platform.Version), 10);
  return Number.isFinite(major) ? major : 0;
}

/**
 * Subject lifting uses VNGenerateForegroundInstanceMaskRequest, which is iOS 17+.
 * The module also has to be linked into the native build (a dev-client rebuild),
 * hence the null check on the native module.
 */
export const isAvailable =
  Platform.OS === 'ios' && nativeModule != null && iosMajorVersion() >= 17;

/**
 * Lifts the foreground subject out of `uri`, bakes a white die-cut outline around
 * its silhouette, and writes a transparent PNG. Resolves with the new file path,
 * its pixel dimensions, and whether a subject was actually found.
 */
export async function liftSubject(uri: string): Promise<LiftResult> {
  if (!nativeModule) {
    throw new Error('SubjectLift native module is unavailable on this platform/build.');
  }
  return nativeModule.liftSubject(uri);
}
