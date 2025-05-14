/**
 * Enum representing environment configuration constants.
 * Contains directory and file path values for environment settings.
 * @enum {string}
 */
export enum EnvironmentConstants {
  ENV_DIR = 'envs', // Directory where environment files are stored
  BASE_ENV_FILE = '.env', // Base environment file for secret keys
}

/**
 * Enum representing specific environment file names.
 * Each value corresponds to a specific environment configuration file.
 * @enum {string}
 */
export enum EnvironmentFiles {
  DEV = '.env.dev', // Development environment file
  UAT = '.env.uat', // User Acceptance Testing environment file
  PROD = '.env.prod', // Production environment file
}

/**
 * Enum representing the secret keys for different environments.
 * @enum {string}
 */
export enum EnvironmentSecretKeyVariables {
  DEV = 'DEV_SECRET_KEY',
  UAT = 'UAT_SECRET_KEY',
  PROD = 'PROD_SECRET_KEY',
}

/**
 * Literal type representing the possible environment stages.
 * This type restricts values to 'dev', 'uat', or 'prod'.
 */
export type EnvironmentStage = 'dev' | 'uat' | 'prod';

/**
 * Tuple type containing all valid environment stages for iteration and validation.
 * This ensures that environment stages are consistent throughout the application.
 */
export const ENVIRONMENT_STAGES: readonly EnvironmentStage[] = ['dev', 'uat', 'prod'] as const;

/**
 * Type guard function to validate if a string is a valid EnvironmentStage.
 * @param value - The string value to check
 * @returns True if the value is a valid environment stage, false otherwise
 */
export function isValidEnvironmentStage(value: string): value is EnvironmentStage {
  return ENVIRONMENT_STAGES.includes(value as EnvironmentStage);
}

/**
 * Interface defining the structure of environment configuration.
 * This ensures consistent structure for all environment objects.
 */
export interface EnvironmentConfig {
  readonly filePath: string;
  readonly secretKey: string;
  readonly baseEnvFile: string;
  readonly envDir: string;
}

/**
 * Mapping of environment stages to their corresponding environment file paths.
 * This mapping is used to select the appropriate environment configuration file.
 */
export const EnvironmentFilePaths: Readonly<Record<EnvironmentStage, string>> = {
  dev: EnvironmentFiles.DEV,
  uat: EnvironmentFiles.UAT,
  prod: EnvironmentFiles.PROD,
};

/**
 * Mapping of environment stages to their corresponding secret keys.
 * This mapping is used to select the appropriate secret key for each environment.
 */
export const SecretKeyPaths: Readonly<Record<EnvironmentStage, string>> = {
  dev: EnvironmentSecretKeyVariables.DEV,
  uat: EnvironmentSecretKeyVariables.UAT,
  prod: EnvironmentSecretKeyVariables.PROD,
};

