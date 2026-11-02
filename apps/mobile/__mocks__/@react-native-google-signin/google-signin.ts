// Manual Jest mock for the Google Sign-In native module (mapped in jest.config.js): the TurboModule does not exist
// under Jest. Default behaviour is a successful sign-in; tests override the jest.fn()s per case.
export const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
};

export const GoogleSignin = {
  configure: jest.fn(),
  hasPlayServices: jest.fn().mockResolvedValue(true),
  signIn: jest.fn().mockResolvedValue({ type: 'success', data: { idToken: 'mock-id-token', user: { email: 'mock@example.com' } } }),
  signOut: jest.fn().mockResolvedValue(null),
};

export const isErrorWithCode = (error: unknown): error is Error & { code: string } =>
  error instanceof Error && 'code' in error;

export const isCancelledResponse = (response: { type: string }): boolean => response.type === 'cancelled';
