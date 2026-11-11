// Expo's default Metro config (it detects the pnpm workspace, so `@prepio/shared` resolves) plus Sentry's
// serializer, which writes Debug IDs into the bundles and source maps so uploaded maps match the shipped code.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname, {
  // No session replay or feedback widget (spec): keep those packages out of the web bundle.
  includeWebReplay: false,
  includeWebFeedback: false,
});
