export const GOOGLE_OAUTH_REDIRECT_URL = '/sso-callback';
export const GOOGLE_OAUTH_COMPLETE_URL = '/redirect';

export const googleOAuthRedirectParams = {
  strategy: 'oauth_google' as const,
  redirectUrl: GOOGLE_OAUTH_REDIRECT_URL,
  redirectUrlComplete: GOOGLE_OAUTH_COMPLETE_URL,
};
