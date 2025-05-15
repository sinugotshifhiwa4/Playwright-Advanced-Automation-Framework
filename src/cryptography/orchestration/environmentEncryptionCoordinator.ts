import { EnvironmentEncryptionManager } from '../services/environmentEncryptionManager';
import { EnvironmentSecretFileManager } from '../../utils/environment/utils/environmentSecretFileManager';
import SecureKeyGenerator from '../keyManagement/secureKeyGenerator';
import ErrorHandler from '../../utils/errors/errorHandler';

export class EnvironmentEncryptionCoordinator {
  private environmentSecretFileManager: EnvironmentSecretFileManager;
  private environmentEncryptionManager: EnvironmentEncryptionManager;

  constructor(
    environmentSecretFileManager: EnvironmentSecretFileManager,
    environmentEncryptionManager: EnvironmentEncryptionManager,
  ) {
    this.environmentSecretFileManager = environmentSecretFileManager;
    this.environmentEncryptionManager = environmentEncryptionManager;
  }

  public async generateAndStoreSecretKey(
    directory: string,
    environmentBaseFilePath: string,
    keyName: string,
  ) {
    try {
      // Call the generateSecretKey method to generate a secret key
      const secretKey = SecureKeyGenerator.generateBase64SecretKey();

      if (!secretKey) {
        ErrorHandler.logAndThrow(
          'Failed to generate secret key: Secret key cannot be null or undefined',
          'createAndSaveSecretKey',
        );
      }

      // Resolve the base file path
      const resolvedBaseEnvironmentFilePath =
        await this.environmentEncryptionManager.resolveFilePath(directory, environmentBaseFilePath);

      // Assuming there is a method to store the secret key
      await this.environmentSecretFileManager.storeBaseEnvironmentKey(
        resolvedBaseEnvironmentFilePath,
        keyName,
        secretKey,
      );
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'generateAndStoreSecretKey',
        'Failed to create and save secret key',
      );
      throw error;
    }
  }

  public async orchestrateEnvironmentEncryption(
    directory: string,
    envFilePath: string,
    secretKeyVariable: string,
    envVariables?: string[],
  ) {
    try {
      // Encrypt environment variables
      await this.environmentEncryptionManager.encryptAndUpdateEnvironmentVariables(
        directory,
        envFilePath,
        secretKeyVariable,
        envVariables,
      );
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'orchestrateEnvironmentEncryption',
        'Failed to orchestrate environment variables',
      );
      throw error;
    }
  }
}
