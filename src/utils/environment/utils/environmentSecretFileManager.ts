import AsyncFileManager from '../../fileManagers/asyncFileManager';
import path from 'path';
import * as environmentConfig from '../constants/environmentFilePaths';
import { FileEncoding } from '../../../models/utils/fileEncoding.enum';
import ErrorHandler from '../../errors/errorHandler';
import logger from '../../logging/loggerManager';

export class EnvironmentSecretFileManager {
  /**
   * Gets the base environment file path
   * @returns Promise resolving to the base environment file path
   * @throws Error if the environment directory does not exist or path resolution fails
   */
  public async getBaseEnvironmentFilePath(): Promise<string> {
    try {
      const envDir = environmentConfig.EnvironmentConstants.ENV_DIR;
      const baseEnvFile = environmentConfig.EnvironmentConstants.BASE_ENV_FILE;

      // Ensure the environment directory exists
      const dirExists = await AsyncFileManager.doesDirectoryExist(envDir);
      if (!dirExists) {
        throw new Error(`Environment directory not found: ${envDir}`);
      }

      return AsyncFileManager.resolvePath(envDir, baseEnvFile);
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'getBaseEnvironmentFilePath',
        'Failed to get base environment file path',
      );
      throw error;
    }
  }

  /**
   * Checks if the base environment file exists
   * @param baseEnvFilePath Path to check
   * @returns Promise resolving to true if file exists, false otherwise
   */
  public async doesBaseEnvFileExist(baseEnvFilePath: string): Promise<boolean> {
    return AsyncFileManager.doesFileExist(baseEnvFilePath);
  }

  /**
   * Returns the path to the environment file with the given file name.
   * @param fileName Name of the environment file
   * @returns Fully resolved path to the environment file
   * @throws Error if path resolution fails
   */
  public resolveEnvironmentFilePath(fileName: string): string {
    try {
      return AsyncFileManager.resolvePath(environmentConfig.EnvironmentConstants.ENV_DIR, fileName);
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'resolveEnvironmentFilePath',
        'Failed to resolve environment file path',
      );
      throw error;
    }
  }

  /**
   * Checks if an environment-specific file exists
   * @param fileName Name of the file to check
   * @returns Promise resolving to true if file exists, false otherwise
   */
  public async doesEnvironmentFileExist(fileName: string): Promise<boolean> {
    const filePath = this.resolveEnvironmentFilePath(fileName);
    return AsyncFileManager.doesFileExist(filePath);
  }

  /**
   * Logs appropriate message when environment file is not found
   * @param fileName Name of the file
   * @param filePath Full path to the file
   * @param envName Environment stage name
   */
  public logEnvironmentFileNotFound(fileName: string, filePath: string, envName: string): void {
    logger.warn(
      `Environment '${envName}' was specified but its configuration file could not be found at ${filePath}.`,
    );
  }

  /**
   * Handles the case when the base environment file is missing
   * @param baseEnvFilePath Path where the base file was expected
   * @throws Error if the base file is required but not found
   */
  public async handleMissingBaseEnvFile(baseEnvFilePath: string): Promise<void> {
    const shouldRequireBaseFile = process.env.REQUIRE_BASE_ENV_FILE === 'true';
    const envDir = environmentConfig.EnvironmentConstants.ENV_DIR;
    const baseEnvFile = environmentConfig.EnvironmentConstants.BASE_ENV_FILE;

    if (shouldRequireBaseFile) {
      ErrorHandler.logAndThrow(
        `Required base environment file not found at ${baseEnvFilePath}. Expected location: ${path.join(envDir, baseEnvFile)}`,
        'handleMissingBaseEnvFile',
      );
    } else {
      const warningMessage = [
        `Base environment file not found at: ${baseEnvFilePath}.`,
        `Expected location based on configuration: ${path.join(envDir, baseEnvFile)}.`,
        `This file is optional if you are running the secret key generation for the first time.`,
        `To suppress this warning in future runs, ensure the file exists or set 'REQUIRE_BASE_ENV_FILE=false'.`,
      ].join('\n');

      logger.warn(warningMessage);
    }
  }

  /**
   * Reads content from the base environment file or creates it if it doesn't exist.
   */
  private async getOrCreateBaseEnvFileContent(filePath: string): Promise<string> {
    try {
      const fileExists = await AsyncFileManager.ensureFileExists(filePath);

      if (!fileExists) {
        logger.warn(
          `Base environment file not found at "${filePath}". A new empty file will be created.`,
        );
        await AsyncFileManager.writeFile(filePath, '', 'Created empty environment file');
        return '';
      }

      return await AsyncFileManager.readFile(filePath, FileEncoding.UTF8);
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'getOrCreateBaseEnvFileContent',
        `Failed to read or initialize environment file at "${filePath}"`,
      );
      throw error;
    }
  }

  private async writeSecretKeyVariableToBaseEnvFile(
    filePath: string,
    content: string,
    keyName: string,
  ): Promise<void> {
    try {
      await AsyncFileManager.writeFile(filePath, content, keyName, FileEncoding.UTF8);
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'writeSecretKeyVariableToBaseEnvFile',
        `Failed to write key "${keyName}" to environment file.`,
      );
      throw error;
    }
  }

  /**
   * Gets the value of a given key from the base environment file.
   */
  public async getKeyValue(filePath: string, keyName: string): Promise<string | undefined> {
    try {
      const fileContent = await this.getOrCreateBaseEnvFileContent(filePath);
      const regex = new RegExp(`^${keyName}=(.*)$`, 'm');
      const match = fileContent.match(regex);
      return match ? match[1] : undefined;
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'getKeyValue',
        `Failed to retrieve value for key "${keyName}".`,
      );
      throw error;
    }
  }

  /**
   * Stores a new key-value pair in the base environment file if it doesn't already exist.
   */
  public async storeBaseEnvironmentKey(
    filePath: string,
    keyName: string,
    keyValue: string,
  ): Promise<void> {
    try {
      let fileContent = await this.getOrCreateBaseEnvFileContent(filePath);

      const keyExists = new RegExp(`^${keyName}=`, 'm').test(fileContent);
      if (keyExists) {
        logger.info(
          `The environment variable "${keyName}" already exists. Delete it before regenerating.`,
        );
        return;
      }

      if (fileContent && !fileContent.endsWith('\n')) {
        fileContent += '\n';
      }

      fileContent += `${keyName}=${keyValue}`;

      await this.writeSecretKeyVariableToBaseEnvFile(filePath, fileContent, keyName);
      logger.info(`Environment variable "${keyName}" has been added successfully.`);
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'storeBaseEnvKey',
        `Failed to store key "${keyName}" in environment file.`,
      );
      throw error;
    }
  }
}
