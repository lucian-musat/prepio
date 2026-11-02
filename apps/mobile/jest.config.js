module.exports = {
  preset: 'jest-expo',
  resolver: require.resolve('react-native-reanimated/jest/resolver'),
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  moduleNameMapper: {
    // The native module does not exist under Jest; the package ships an in-memory mock.
    '^@react-native-async-storage/async-storage$': '@react-native-async-storage/async-storage/jest/async-storage-mock',
  },
};
