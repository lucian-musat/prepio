// Icon fonts are binary assets; render icons as plain Text in tests.
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => {
  const { createElement } = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ name }) => createElement(Text, null, name),
  };
});
