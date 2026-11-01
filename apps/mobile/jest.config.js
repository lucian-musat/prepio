module.exports = {
  preset: 'jest-expo',
  resolver: require.resolve('react-native-reanimated/jest/resolver'),
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
};