import EnvironmentConfigLoader from '../../../utils/environment/utils/environmentConfigManager';
import { EnvironmentSecretFileManager } from '../../../utils/environment/utils/environmentSecretFileManager';
import AuthStorageManager from '../../../utils/auth/storage/authStorageManager';
import ErrorHandler from '../../../utils/errors/errorHandler';
import logger from '../../../utils/logging/loggerManager';

async function initializeEnvironment(): Promise<void> {
  const environmentConfigLoader = new EnvironmentConfigLoader(new EnvironmentSecretFileManager());
  try {
    await environmentConfigLoader.initialize();
  } catch (error: unknown) {
    ErrorHandler.captureError(
      error,
      'initializeEnvironment',
      'Failed to initialize environment variables',
    );
    throw error;
  }
}

async function resetAuthState(): Promise<void> {
  AuthStorageManager.initializeEmptyAuthStateFile();
}

async function globalSetup(): Promise<void> {
  try {
    await Promise.all([
      initializeEnvironment(),
      resetAuthState(),
    ]);
    logger.debug('Global setup completed successfully');
  } catch (error: unknown) {
    ErrorHandler.captureError(error, 'globalSetup', 'Global setup failed');
    throw error;
  }
}

export default globalSetup;
