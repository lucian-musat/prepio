// Gestures are native-only and need the worklets runtime, which does not exist under Jest: stand in for the
// pieces the app uses (tests cover logic; pinch/pan is validated on a device).
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  return {
    GestureHandlerRootView: View,
    GestureDetector: ({ children }) => children,
    usePinchGesture: () => ({}),
    usePanGesture: () => ({}),
    useTapGesture: () => ({}),
    useSimultaneousGestures: () => ({}),
  };
});

// The WebView is a native module (no Jest binding): a plain View stands in, so any screen that renders a
// video card can load. The video player itself is validated in the browser and on a device.
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View, WebView: View };
});
