module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  resolver: require.resolve('react-native-reanimated/jest/resolver'),
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  moduleNameMapper: {
    // The native module does not exist under Jest; the package ships an in-memory mock.
    '^@react-native-async-storage/async-storage$': '@react-native-async-storage/async-storage/jest/async-storage-mock',
    // Google Sign-In is a native TurboModule: a manual mock stands in for it.
    '^@react-native-google-signin/google-signin$': '<rootDir>/__mocks__/@react-native-google-signin/google-signin.ts',
  },
};
