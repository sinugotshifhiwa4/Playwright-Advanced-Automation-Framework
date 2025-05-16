/**
 * Configuration options for login state
 */
export interface LoginConfig {
  /** Flag indicating if authentication should be performed */
  requireAuth: boolean;
  /** Flag indicating if existing authentication state should be checked */
  requireAuthState: boolean;
}