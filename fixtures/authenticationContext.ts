import EnvironmentDetector from '../src/config/environmentDetector';
import { EnvironmentResolver } from '../src/config/environment/resolver/environmentResolver';
import { LoginConfig } from '../src/models/utils/AuthContext.interface';
import { LoginPage } from '../src/ui/pages/loginPage';
import { SideMenuPage } from '../src/ui/pages/sideMenuPage';
import ErrorHandler from '../src/utils/errors/errorHandler';
import logger from '../src/utils/logging/loggerManager';

/**
 * Manages authentication, login state and portal navigation
 */
export class AuthenticationContext {
  private readonly environmentResolver: EnvironmentResolver;
  private readonly loginPage: LoginPage;
  private readonly sideMenuPage: SideMenuPage;

  constructor(
    environmentResolver: EnvironmentResolver,
    loginPage: LoginPage,
    sideMenuPage: SideMenuPage,
  ) {
    this.environmentResolver = environmentResolver;
    this.loginPage = loginPage;
    this.sideMenuPage = sideMenuPage;
  }

  /**
   * Navigates to the portal base URL
   * @throws Error if navigation fails
   */
  async navigateToPortal(): Promise<void> {
    try {
      EnvironmentDetector.isRunningInCI();
      const portalBaseUrl = await this.environmentResolver.getPortalBaseUrl();
      await this.loginPage.navigateToUrl(portalBaseUrl);
    } catch (error) {
      ErrorHandler.captureError(error, 'navigateToPortal', 'Failed to navigate to portal');
      throw error;
    }
  }

  /**
   * Configures the login state for the user based on the provided configuration
   *
   * @param config - Optional configuration options for login behavior
   *
   * The function first checks if the user is already authenticated based on the provided configuration.
   * If the user is not authenticated or if authentication is required, it will navigate to the portal
   * and perform the login process using credentials obtained from the environment resolver.
   * It verifies that the login was successful by checking the absence of any login error messages
   * and the visibility of the dashboard tab.
   *
   * @throws Error if the login process fails
   */
  async configureLoginState(config?: Partial<LoginConfig>): Promise<void> {
    try {
      // Apply defaults to any missing config options
      // Make sure config overrides defaults by placing ...config last
      const fullConfig: LoginConfig = {
        requireAuth: true,
        requireAuthState: true,
        ...config,
      };

      logger.debug(
        `Login config - requireAuth: ${fullConfig.requireAuth}, requireAuthState: ${fullConfig.requireAuthState}`,
      );

      // Check if user is already authenticated
      if (fullConfig.requireAuthState && (await this.isUserAuthenticated())) {
        logger.info('User is already authenticated, skipping login');
        return;
      }

      await this.navigateToPortal();
      await this.loginPage.verifyOrangeHrmLogoIsVisible();

      if (fullConfig.requireAuth) {
        const { username, password } = await this.environmentResolver.getCredentials();

        await this.loginPage.loginToPortal(username, password);
        await this.loginPage.verifyErrorMessageHidden();
        await this.sideMenuPage.verifyDashboardMenuIsVisible();
      } else {
        logger.info('Authentication not required, skipping login');
      }
    } catch (error) {
      ErrorHandler.captureError(error, 'configureLoginState', 'Failed to configure login state');
      throw error;
    }
  }

  /**
   * Checks if the user is currently authenticated
   * @returns Promise that resolves to true if user is authenticated, false otherwise
   */
  async isUserAuthenticated(): Promise<boolean> {
    try {
      const isAuthenticated = await this.sideMenuPage.isDashboardMenuVisible();
      logger.info(`User ${isAuthenticated ? 'authenticated' : 'not authenticated'}`);
      return isAuthenticated;
    } catch (error) {
      logger.warn('Error checking authentication status:', error);
      return false;
    }
  }
}
