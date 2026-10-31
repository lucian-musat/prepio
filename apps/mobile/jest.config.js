module.exports = {
  preset: 'jest-expo',
  resolver: require.resolve('react-native-reanimated/jest/resolver'),
  setupFiles: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
};