/**
 * Platform-specific Clerk hooks
 * This file exports the correct Clerk hooks based on the current platform
 * - On web: uses @clerk/clerk-react
 * - On native: uses @clerk/clerk-expo
 */

import { Platform } from 'react-native';

// Import all hooks from both packages
import {
  useAuth as useAuthExpo,
  useUser as useUserExpo,
  useSignIn as useSignInExpo,
  useSignUp as useSignUpExpo,
  useSession as useSessionExpo,
  useClerk as useClerkExpo,
  useOAuth as useOAuthExpo,
} from '@clerk/clerk-expo';

import {
  useAuth as useAuthReact,
  useUser as useUserReact,
  useSignIn as useSignInReact,
  useSignUp as useSignUpReact,
  useSession as useSessionReact,
  useClerk as useClerkReact,
} from '@clerk/clerk-react';

// Export platform-specific hooks
export const useAuth = Platform.OS === 'web' ? useAuthReact : useAuthExpo;
export const useUser = Platform.OS === 'web' ? useUserReact : useUserExpo;
export const useSignIn = Platform.OS === 'web' ? useSignInReact : useSignInExpo;
export const useSignUp = Platform.OS === 'web' ? useSignUpReact : useSignUpExpo;
export const useSession =
  Platform.OS === 'web' ? useSessionReact : useSessionExpo;
export const useClerk = Platform.OS === 'web' ? useClerkReact : useClerkExpo;

// OAuth is only available on native platforms
// On web, OAuth is handled differently through redirects
export const useOAuth =
  Platform.OS === 'web'
    ? () => {
        console.warn(
          '⚠️ useOAuth is not available on web. Use signIn.authenticateWithRedirect() instead.',
        );
        return {
          startOAuthFlow: () => {
            throw new Error(
              'OAuth flow is not available on web platform. Please use email/password or configure OAuth redirects.',
            );
          },
        };
      }
    : useOAuthExpo;
