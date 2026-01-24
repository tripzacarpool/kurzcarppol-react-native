import React from 'react';
import { ClerkProvider } from '@clerk/clerk-expo';

export const ClerkProviderWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error(
      'Missing Clerk publishable key - set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in .env',
    );
  }

  return <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider>;
};
