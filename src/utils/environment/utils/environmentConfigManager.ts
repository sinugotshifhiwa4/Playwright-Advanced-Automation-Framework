import dotenv from 'dotenv';
import * as environmentConfig from '../constants/environmentFilePaths';
import { EnvironmentSecretFileManager } from './environmentSecretFileManager';
import EnvironmentDetector from '../../../config/environmentDetector';
import path from 'path';
import ErrorHandler from '../../errors/errorHandler';
import logger from '../../logging/loggerManager';

/**
 * Responsible for loading and managing environment configuration files
 * Handles initialization of environment variables from appropriate .env files
 */
export default class EnvironmentConfigLoader {
  private environmentSecretFileManager: EnvironmentSecretFileManager;

  // Instance state tracking
  public initialized = false;
  public loadedFiles: string[] = [];
  public activeEnvironment: environmentConfig.EnvironmentStage | null = null;

  constructor(environmentSecretFileManager: EnvironmentSecretFileManager) {
    this.environmentSecretFileManager = environmentSecretFileManager;
  }

  /**
   * Initializes the environment configuration.
   * Loads environment variables from appropriate files based on current environment.
   * @returns Promise that resolves when initialization is complete
   * @throws Error if initialization fails
   */
  public async initialize(): Promise<void> {
    // Skip if already initialized
    if (this.initialized) {
      logger.info('Environment already initialized, skipping');
      return;
    }

    try {
      // Skip local file loading in CI environments8
      if (EnvironmentDetector.isRunningInCI()) {
        logger.info('CI environment detected. Skipping local environment file loading.');
        this.initialized = true;
        return;
      }

      // Setup environment using the helper method
      await this.setupEnvironment();
      this.initialized = true;
      logger.info(
        `Environment successfully initialized with ${this.loadedFiles.length} config files`,
      );
    } catch (error) {
      ErrorHandler.captureError(error, 'initialize', 'Failed to set up environment variables');
      throw error;
    }
  }

  /**
   * Forces a reload of all environment files.
   * @returns Promise that resolves when reload is complete
   * @throws Error if reload fails
   */
  public async reload(): Promise<void> {
    try {
      logger.debug('Reloading environment configuration...');
      this.initialized = false;
      this.loadedFiles = [];
      this.activeEnvironment = null;
      await this.initialize();
      logger.info(
        `Environment configuration reloaded successfully with files: ${this.loadedFiles.join(', ')}`,
      );
    } catch (error) {
      ErrorHandler.captureError(error, 'reload', 'Failed to reload environment configuration');
      throw error;
    }
  }

  /**
   * Gets the currently active environment
   * @returns The active environment stage or null if not initialized
   */
  public getActiveEnvironment(): environmentConfig.EnvironmentStage | null {
    return this.activeEnvironment;
  }

  /**
   * Gets the list of environment files that were successfully loaded
   * @returns Array of loaded file names
   */
  public getLoadedFiles(): string[] {
    return [...this.loadedFiles];
  }

  /**
   * Helper method to setup the environment configuration
   * Handles loading base and environment-specific files, validation,
   * and setting up file watchers for development mode
   */
  private async setupEnvironment(): Promise<void> {
    // Base env file path
    const baseEnvFilePath = await this.environmentSecretFileManager.getBaseEnvironmentFilePath();

    // Handle base environment file
    await this.loadBaseEnvironmentFile(baseEnvFilePath);

    // Load base environment variables and determine the current environment
    const env = this.resolveActiveEnvironment();
    this.activeEnvironment = env as environmentConfig.EnvironmentStage;

    // Get environment configuration and load environment-specific file
    const envSpecificFilePath =
      environmentConfig.EnvironmentFilePaths[env as environmentConfig.EnvironmentStage];
    await this.loadEnvironmentFileForStage(envSpecificFilePath, env);

    // Validate required environment variables if specified
    const requiredVarsString = process.env.REQUIRED_ENV_VARS;
    if (requiredVarsString) {
      const requiredVars = requiredVarsString.split(',').map((v) => v.trim());
      this.validateRequiredEnvironmentVariables(requiredVars);
    }
  }

  /**
   * Loads and processes the base environment file
   * @private
   * @param baseEnvFilePath Path to the base environment file
   * @throws Error if loading fails and the base file is required
   */
  public async loadBaseEnvironmentFile(baseEnvFilePath: string): Promise<void> {
    try {
      // Check if the base environment file exists
      const baseEnvExists =
        await this.environmentSecretFileManager.doesBaseEnvFileExist(baseEnvFilePath);

      if (baseEnvExists) {
        this.applyEnvironmentVariablesFromFile(baseEnvFilePath);
        // Track loaded file
        const baseName = path.basename(baseEnvFilePath);
        this.loadedFiles.push(baseName);
        logger.info(`Successfully loaded base environment file: ${baseName}`);
      } else {
        await this.environmentSecretFileManager.handleMissingBaseEnvFile(baseEnvFilePath);
      }
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'loadBaseEnvironmentFile',
        'Failed to load base environment file',
      );
      throw error;
    }
  }

  /**
   * Resolves the active environment from ENV variable
   * @private
   * @returns The resolved environment stage
   */
  public resolveActiveEnvironment(): string {
    try {
      const env = this.getCurrentEnvironment();

      // Validate that the specified environment is valid
      if (!environmentConfig.isValidEnvironmentStage(env)) {
        const validEnvironments = environmentConfig.ENVIRONMENT_STAGES.join(', ');
        logger.warn(
          `Invalid environment specified: ${env}. Expected one of: ${validEnvironments}.`,
        );
      }

      logger.debug(`Environment specified: '${env}'`);
      return env;
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'resolveActiveEnvironment',
        'Failed to resolve active environment',
      );
      throw error;
    }
  }

  /**
   * Tries to load an environment file for the specified stage
   * @private
   * @param fileName Name of the environment file
   * @param envName Name of the environment stage
   * @returns Promise resolving to true if file was loaded, false otherwise
   */
  public async loadEnvironmentFileForStage(fileName: string, envName: string): Promise<boolean> {
    try {
      // Get the path to the file
      const filePath = this.environmentSecretFileManager.resolveEnvironmentFilePath(fileName);
      const fileExists = await this.environmentSecretFileManager.doesEnvironmentFileExist(fileName);

      if (fileExists) {
        // Get base file name for logging
        const baseName = path.basename(filePath);
        this.applyEnvironmentVariablesFromFile(filePath);
        this.loadedFiles.push(baseName);
        logger.info(`Successfully loaded variables from environment file: ${baseName}`);
        return true;
      } else {
        this.environmentSecretFileManager.logEnvironmentFileNotFound(fileName, filePath, envName);
        return false;
      }
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'loadEnvironmentFileForStage',
        `Failed to load environment file for ${envName}`,
      );
      return false;
    }
  }

  /**
   * Loads environment variables from the specified file path using the dotenv library.
   * @private
   * @param filePath Path to the environment file
   * @throws Error if loading fails
   */
  public applyEnvironmentVariablesFromFile(filePath: string): void {
    try {
      const result = dotenv.config({ path: filePath, override: true });

      if (result.error) {
        ErrorHandler.logAndThrow(
          `Error loading environment variables from ${filePath}: ${result.error.message}`,
          'applyEnvironmentVariablesFromFile',
        );
      }
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'applyEnvironmentVariablesFromFile',
        `Failed to apply environment variables from ${filePath}`,
      );
      throw error;
    }
  }

  /**
   * Validates that all required environment variables are present.
   * Throws an error if any required variable is missing.
   *
   * @param requiredVars - Array of environment variable names that are required
   * @returns {void}
   */
  public validateRequiredEnvironmentVariables(requiredVars: string[]): void {
    try {
      const missing = requiredVars.filter((varName) => process.env[varName] === undefined);
      if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
      }
      logger.info('All required environment variables are present');
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'validateRequiredEnvironmentVariables',
        'Failed to validate required environment variables',
      );
      throw error;
    }
  }

  /**
   * Gets the current environment from process.env
   * @returns The current environment string
   */
  public getCurrentEnvironment(): string {
    return process.env.ENV || 'dev';
  }
}
