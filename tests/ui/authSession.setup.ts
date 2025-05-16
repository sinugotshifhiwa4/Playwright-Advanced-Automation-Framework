import { test as authSession } from '../../fixtures/orangeHrm.fixture';
import logger from '../../src/utils/logging/loggerManager';

/**
 * Authenticates the user by:
 * - Navigating to the login page
 * - Logging into the portal
 * - Saving the authenticated browser session state
 *
 * This session can be reused across tests that require a pre-authenticated context.
 */
authSession(
  `Authenticate @sanity @regression`,
  async ({ authenticationContext, browserSessionManager }) => {
    await authenticationContext.configureLoginState({
      requireAuth: true,
      requireAuthState: false,
    });
    await browserSessionManager.saveSessionState();

    logger.info('Authentication session state setup completed and saved successfully.');
  },
);
