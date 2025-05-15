import EncryptionService from './encryptionService';
import AsyncFileManager from '../../utils/fileManagers/asyncFileManager';
import { FileEncoding } from '../../models/utils/fileEncoding.enum';
import ErrorHandler from '../../utils/errors/errorHandler';
import logger from '../../utils/logging/loggerManager';

export class EnvironmentEncryptionManager {
  public async encryptAndUpdateEnvironmentVariables(
    directory: string,
    environmentFilePath: string,
    secretKeyVariable: string,
    envVariables?: string[],
  ): Promise<void> {
    try {
      // Read the environment file
      const envFileLines = await this.readEnvironmentFileAsLines(directory, environmentFilePath);

      // Extract all key-value pairs from the environment file
      const allEnvVariables = this.extractEnvironmentVariables(envFileLines);

      // Determine which variables to encrypt
      const variablesToEncrypt = this.resolveVariablesToEncrypt(allEnvVariables, envVariables);

      // Update lines with encrypted values
      const { updatedLines, encryptedCount } = await this.encryptVariableValuesInFileLines(
        envFileLines,
        variablesToEncrypt,
        secretKeyVariable,
      );

      // Resolve the environment file path
      const resolvedEnvironmentFilePath = await this.resolveFilePath(
        directory,
        environmentFilePath,
      );

      // Write the updated lines to the environment file
      await this.writeEnvironmentFileLines(resolvedEnvironmentFilePath, updatedLines);

      // Only log if encryption was performed
      this.logEncryptionSuccess(
        directory,
        environmentFilePath,
        Object.keys(variablesToEncrypt).length,
        encryptedCount,
      );
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'encryptAndUpdateEnvironmentVariables',
        'Failed to encrypt and update environment parameters',
      );
      throw error;
    }
  }

  private resolveVariablesToEncrypt(
    allEnvVariables: Record<string, string>,
    envVariables?: string[],
  ): Record<string, string> {
    const variablesToEncrypt: Record<string, string> = {};

    if (envVariables && envVariables.length > 0) {
      for (const lookupValue of envVariables) {
        const found = this.findEnvironmentVariableByKey(allEnvVariables, lookupValue);
        if (!found) {
          logger.warn(
            `Environment variable with key or value '${lookupValue}' not found in the file.`,
          );
        }
        Object.assign(variablesToEncrypt, found);
      }
    } else {
      Object.assign(variablesToEncrypt, allEnvVariables);
    }

    return variablesToEncrypt;
  }

  private findEnvironmentVariableByKey(
    allEnvVariables: Record<string, string>,
    lookupValue: string,
  ): Record<string, string> {
    const result: Record<string, string> = {};

    // Check if it's a key
    if (allEnvVariables[lookupValue]) {
      result[lookupValue] = allEnvVariables[lookupValue];
      return result;
    }

    // Check if it's a value
    for (const [key, value] of Object.entries(allEnvVariables)) {
      if (value === lookupValue) {
        result[key] = value;
        logger.info(`Environment variable key '${key}' found`);
        return result;
      }
    }

    return result;
  }

  private async encryptVariableValuesInFileLines(
    envFileLines: string[],
    variablesToEncrypt: Record<string, string>,
    secretKeyVariable: string,
  ): Promise<{ updatedLines: string[]; encryptedCount: number }> {
    try {
      let updatedLines = [...envFileLines];
      let encryptedCount = 0;

      for (const [key, value] of Object.entries(variablesToEncrypt)) {
        if (value) {
          // Check if encryption is needed
          const encryptedValue = await this.encryptValueIfPlaintext(
            value.trim(),
            secretKeyVariable,
          );
          if (!encryptedValue || encryptedValue === value) {
            logger.info(`Skipping encryption: '${key}' is already encrypted.`);
            continue;
          }

          // Update the lines with the encrypted value
          updatedLines = this.updateEnvironmentFileLines(
            updatedLines,
            key,
            JSON.stringify(encryptedValue),
          );
          encryptedCount++;
        }
      }

      return { updatedLines, encryptedCount };
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'encryptVariableValuesInFileLines',
        'Failed to encrypt variable values in file lines',
      );
      throw error;
    }
  }

  private async encryptValueIfPlaintext(value: string, secretKey: string) {
    if (this.isAlreadyEncrypted(value)) {
      return value;
    }

    // Encrypt the value
    const encryptedResult = await EncryptionService.encrypt(value, secretKey);
    const { salt, iv, cipherText } = encryptedResult;

    return { salt, iv, cipherText };
  }

  private isAlreadyEncrypted(value: string): boolean {
    if (!value) {
      logger.warn('Environment variable cannot be null or empty.');
      return false;
    }

    // Check if the value is a potential JSON object
    const trimmedValue = value.trim();
    if (!(trimmedValue.startsWith('{') && trimmedValue.endsWith('}'))) {
      return false;
    }

    try {
      const parsedData = JSON.parse(value);

      // Check for required encryption fields
      const hasEncryptionFields =
        typeof parsedData === 'object' &&
        parsedData !== null &&
        'salt' in parsedData &&
        'iv' in parsedData &&
        'cipherText' in parsedData;

      return hasEncryptionFields;
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'isAlreadyEncrypted',
        'Failed to parse environment variable',
      );
      return false;
    }
  }

  private extractEnvironmentVariables(lines: string[]): Record<string, string> {
    try {
      const variables: Record<string, string> = {};

      for (const line of lines) {
        const parsedVariable = this.parseEnvironmentLine(line);
        if (parsedVariable) {
          const [key, value] = parsedVariable;
          variables[key] = value;
        }
      }

      return variables;
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'extractEnvironmentVariables',
        'Failed to extract environment variables',
      );
      throw error;
    }
  }

  private parseEnvironmentLine(line: string): [string, string] | null {
    const trimmedLine = line.trim();
    if (trimmedLine === '' || !trimmedLine.includes('=')) {
      return null;
    }

    const [key, ...valueParts] = trimmedLine.split('=');
    const value = valueParts.join('='); // Handle values that might contain '='

    if (key && value) {
      return [key.trim(), value.trim()];
    }

    return null;
  }

  private updateEnvironmentFileLines(
    existingLines: string[],
    envVariable: string,
    value: string,
  ): string[] {
    try {
      let isUpdated = false;

      const updatedLines = existingLines.map((line) => {
        if (line.startsWith(`${envVariable}=`)) {
          isUpdated = true;
          return `${envVariable}=${value}`;
        }
        return line;
      });

      if (!isUpdated) {
        updatedLines.push(`${envVariable}=${value}`);
      }

      return updatedLines;
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'updateEnvironmentFileLines',
        'Failed to update environment file lines',
      );
      throw error;
    }
  }

  private async readEnvironmentFileAsLines(
    directory: string,
    environmentFilePath: string,
  ): Promise<string[]> {
    try {
      const resolvedEnvironmentFilePath = await this.resolveFilePath(
        directory,
        environmentFilePath,
      );

      const content = await AsyncFileManager.readFile(
        resolvedEnvironmentFilePath,
        FileEncoding.UTF8,
      );
      return content.split('\n');
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'readEnvironmentFileAsLines',
        'Failed to read environment file',
      );
      throw error;
    }
  }

  private async writeEnvironmentFileLines(environmentFilePath: string, lines: string[]) {
    try {
      await AsyncFileManager.writeFile(environmentFilePath, lines.join('\n'), FileEncoding.UTF8);
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'writeEnvironmentFileLines',
        'Failed to write encrypted lines to environment file',
      );
      throw error;
    }
  }

  private async logEncryptionSuccess(
    directory: string,
    environmentFilePath: string,
    originalCount: number,
    encryptedCount: number,
  ): Promise<void> {
    try {
      // Only log if encryption actually happened
      if (encryptedCount > 0) {
        const filePath = await this.resolveFilePath(directory, environmentFilePath);

        logger.info(
          `Encryption complete. Successfully encrypted ${encryptedCount} variable(s) in the ${filePath} file.`,
        );
      }
      // No else message needed since individual skips are already logged
    } catch (error) {
      ErrorHandler.captureError(error, 'logEncryptionSuccess', 'Failed to log encryption success');
      throw error;
    }
  }

  /**
   * Resolves a file path by ensuring the directory exists and generating the full path.
   */
  public async resolveFilePath(directoryName: string, fileName: string): Promise<string> {
    try {
      await AsyncFileManager.ensureDirectoryExists(directoryName);
      return AsyncFileManager.getFilePath(directoryName, fileName);
    } catch (error) {
      ErrorHandler.captureError(error, 'resolveFilePath', 'Failed to resolve file path.');
      throw error;
    }
  }
}
