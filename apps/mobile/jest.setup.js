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
