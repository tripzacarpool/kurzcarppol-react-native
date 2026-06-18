/**
 * Platform-specific Clerk hooks.
 *
 * Web uses @clerk/clerk-react. Native uses @clerk/clerk-expo.
 */

import { Platform } from 'react-native';

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

export const useAuth = Platform.OS === 'web' ? useAuthReact : useAuthExpo;
export const useUser = Platform.OS === 'web' ? useUserReact : useUserExpo;
export const useSignIn = Platform.OS === 'web' ? useSignInReact : useSignInExpo;
export const useSignUp = Platform.OS === 'web' ? useSignUpReact : useSignUpExpo;
export const useSession =
  Platform.OS === 'web' ? useSessionReact : useSessionExpo;
export const useClerk = Platform.OS === 'web' ? useClerkReact : useClerkExpo;

export const useOAuth =
  Platform.OS === 'web'
    ? () => ({
        startOAuthFlow: () => {
          throw new Error(
            'OAuth flow is not available on web. Use Clerk redirect auth on web.',
          );
        },
      })
    : useOAuthExpo;
