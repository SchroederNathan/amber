import { useSaveImages } from '@/lib/use-save-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';
import { isAvailable as stickerLiftAvailable, liftSubject } from 'subject-lift';

type CaptureMode = 'photo' | 'sticker';

// The amber accent matches theme.colors.primary (identical in both themes).
const AMBER = '#e6a23c';
const INACTIVE = 'rgba(255,255,255,0.55)';

export default function CameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [position, setPosition] = useState<'back' | 'front'>('back');
  const device = useCameraDevice(position);
  const photoOutput = usePhotoOutput();
  const saveImages = useSaveImages();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<CaptureMode>('photo');

  // Slides the active-label highlight between Photo (0) and Sticker (1).
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(mode === 'sticker' ? 1 : 0, { duration: 200 });
  }, [mode, progress]);

  const switchMode = useCallback((next: CaptureMode) => {
    if (next === 'sticker' && !stickerLiftAvailable) return;
    setMode((current) => {
      if (current !== next && process.env.EXPO_OS === 'ios') {
        Haptics.selectionAsync();
      }
      return next;
    });
  }, []);

  // Horizontal swipe over the preview toggles modes (iOS-camera style). The
  // activeOffsetX keeps taps and vertical drags from triggering it.
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .onEnd((event) => {
          'worklet';
          if (event.translationX < -40) runOnJS(switchMode)('sticker');
          else if (event.translationX > 40) runOnJS(switchMode)('photo');
        }),
    [switchMode],
  );

  const photoLabelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [AMBER, INACTIVE]),
  }));
  const stickerLabelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [INACTIVE, AMBER]),
  }));

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;
    setBusy(true);
    try {
      await saveImages(
        result.assets.map((asset) => ({
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          mimeType: asset.mimeType,
        })),
      );
      router.back();
    } catch {
      Alert.alert('Could not save', 'Uploading failed. Try again.');
      setBusy(false);
    }
  };

  const capture = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (process.env.EXPO_OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      const photoFile = await photoOutput.capturePhotoToFile({}, {});
      const uri = `file://${photoFile.filePath}`;

      if (mode === 'sticker') {
        const sticker = await liftSubject(uri);
        if (!sticker.hasSubject) {
          Alert.alert(
            'No subject found',
            'Point the camera at a clear subject and try again.',
          );
          setBusy(false);
          return;
        }
        await saveImages([
          {
            uri: sticker.uri,
            width: sticker.width,
            height: sticker.height,
            mimeType: 'image/png',
            isSticker: true,
          },
        ]);
      } else {
        await saveImages([{ uri }]);
      }
      router.back();
    } catch {
      Alert.alert('Capture failed', 'Could not take that photo. Try again.');
      setBusy(false);
    }
  };

  const renderFallback = (title: string, message: string, action?: React.ReactNode) => (
    <View style={styles.fallback}>
      <SymbolView name="camera" size={40} tintColor="#8d8271" />
      <Text style={styles.fallbackTitle}>{title}</Text>
      <Text style={styles.fallbackMessage}>{message}</Text>
      {action}
      <Pressable style={styles.fallbackButton} onPress={pickFromLibrary}>
        <Text style={styles.fallbackButtonText}>Pick from library instead</Text>
      </Pressable>
    </View>
  );

  let body: React.ReactNode;
  if (!hasPermission) {
    body = renderFallback(
      'Camera access needed',
      'Amber uses the camera to capture things you want to keep.',
      <Pressable style={[styles.fallbackButton, styles.fallbackPrimary]} onPress={requestPermission}>
        <Text style={[styles.fallbackButtonText, { color: '#fff' }]}>Allow camera</Text>
      </Pressable>,
    );
  } else if (device == null) {
    body = renderFallback(
      'No camera here',
      'This device has no camera (hello, Simulator).',
    );
  } else {
    body = (
      <Camera
        isActive
        device={device}
        outputs={[photoOutput]}
        style={styles.camera}
        resizeMode="cover"
      />
    );
  }

  const showControls = hasPermission && device;

  return (
    <View style={styles.container}>
      <GestureDetector gesture={swipe}>
        <View style={styles.preview}>{body}</View>
      </GestureDetector>

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <Pressable style={styles.roundButton} onPress={() => router.back()}>
          <SymbolView name="xmark" size={17} tintColor="#fff" weight="semibold" />
        </Pressable>
        {showControls ? (
          <Pressable
            style={styles.roundButton}
            onPress={() => setPosition((p) => (p === 'back' ? 'front' : 'back'))}
          >
            <SymbolView
              name="arrow.triangle.2.circlepath.camera"
              size={17}
              tintColor="#fff"
            />
          </Pressable>
        ) : null}
      </View>

      {showControls ? (
        <>
          {stickerLiftAvailable ? (
            <View style={[styles.modeSelector, { bottom: insets.bottom + 118 }]}>
              <Pressable hitSlop={10} onPress={() => switchMode('photo')}>
                <Animated.Text style={[styles.modeLabel, photoLabelStyle]}>
                  PHOTO
                </Animated.Text>
              </Pressable>
              <Pressable hitSlop={10} onPress={() => switchMode('sticker')}>
                <Animated.Text style={[styles.modeLabel, stickerLabelStyle]}>
                  STICKER
                </Animated.Text>
              </Pressable>
            </View>
          ) : null}

          <View style={[styles.bottomBar, { bottom: insets.bottom + 24 }]}>
            <Pressable style={styles.libraryButton} onPress={pickFromLibrary}>
              <SymbolView name="photo.on.rectangle" size={20} tintColor="#fff" />
            </Pressable>
            <Pressable style={styles.shutter} onPress={capture} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#1a1712" />
              ) : (
                <View style={styles.shutterInner} />
              )}
            </Pressable>
            <View style={styles.libraryButton} />
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  preview: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSelector: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(3),
  },
  modeLabel: {
    fontFamily: theme.fonts.bold,
    fontSize: 13,
    letterSpacing: 1.5,
  },
  bottomBar: {
    position: 'absolute',
    left: 32,
    right: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  libraryButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 3,
    borderColor: theme.colors.primary,
    backgroundColor: '#fff',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.gap(4),
    gap: theme.gap(1.5),
    backgroundColor: '#12100c',
  },
  fallbackTitle: {
    fontFamily: theme.fonts.display,
    fontSize: 22,
    color: '#f4eddd',
  },
  fallbackMessage: {
    fontFamily: theme.fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: '#a2977f',
    textAlign: 'center',
  },
  fallbackButton: {
    paddingVertical: theme.gap(1.25),
    paddingHorizontal: theme.gap(2.5),
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  fallbackPrimary: {
    backgroundColor: theme.colors.primary,
  },
  fallbackButtonText: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: '#f4eddd',
  },
}));
