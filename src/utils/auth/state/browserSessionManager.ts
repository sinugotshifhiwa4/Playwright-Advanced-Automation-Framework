import { Page } from '@playwright/test';
import AuthStorageManager from '../storage/authStorageManager';
import ErrorHandler from '../../errors/errorHandler';
import logger from '../../logging/loggerManager';

export class BrowserSessionManager {
  private readonly page: Page;
  
  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Saves the current browser session state to the authentication state file
   * @returns Promise that resolves when the storage state has been saved
   */
  async saveSessionState(): Promise<void> {
    try {
      const storagePath = AuthStorageManager.resolveAuthStateFilePath();
      await this.page.context().storageState({ path: storagePath });
      logger.debug(`Successfully saved browser session state to: ${storagePath}`);
    } catch (error) {
      ErrorHandler.captureError(error, 'saveSessionState', 'Failed to save browser session state');
      throw error;
    }
  }

  /**
   * Checks if the current session state is valid or expired
   * @param expiryMinutes Time in minutes after which the session is considered expired
   * @returns Promise that resolves to true if session exists and is not expired
   */
  async isSessionValid(expiryMinutes: number = 60): Promise<boolean> {
    try {
      // Check if auth state file exists
      if (!(await AuthStorageManager.doesAuthStateFileExist())) {
        logger.info('No session state file exists');
        return false;
      }
      
      // Directly delegate to AuthStorageManager for expiration check
      const isExpired = await AuthStorageManager.isAuthStateExpired(expiryMinutes);
      if (isExpired) {
        logger.info(`Session state is expired (older than ${expiryMinutes} minutes)`);
        return false;
      }
      
      return true;
    } catch (error) {
      logger.warn(`Error checking session validity: ${error}`);
      return false; // Assume invalid if there was an error
    }
  }

  /**
   * Clears the current session state by initializing an empty state file
   * @returns true if successfully cleared, false otherwise
   */
  clearSessionState(): boolean {
    try {
      return AuthStorageManager.initializeEmptyAuthStateFile();
    } catch (error) {
      logger.error(`Failed to clear session state: ${error}`);
      return false;
    }
  }

  /**
   * Gets the storage state path if it exists and is valid
   * @param expiryMinutes Time in minutes after which the session is considered expired
   * @returns Promise that resolves to the storage path or undefined if no valid state exists
   */
  async getStorageState(expiryMinutes: number = 60): Promise<string | undefined> {
    try {
      const storagePath = AuthStorageManager.resolveAuthStateFilePath();
      
      // Check if auth state file exists
      if (!(await AuthStorageManager.doesAuthStateFileExist())) {
        logger.warn(`Auth state file not found at: ${storagePath}`);
        return undefined;
      }
  
      // Check if the state is valid (not expired)
      if (await this.isSessionValid(expiryMinutes)) {
        logger.info(`Using existing auth state from: ${storagePath}`);
        return storagePath;
      } else {
        logger.warn(`Auth state file exists but is expired`);
        return undefined;
      }
    } catch (error) {
      logger.warn(`[Auth] Error retrieving storage state: ${error}`);
      return undefined;
    }
  }
}