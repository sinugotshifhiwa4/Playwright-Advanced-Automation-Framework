/**
 * Result type for operations that could fail
 */
export interface FileOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * Options for file operations
 */
export interface FileOperationOptions {
  throwOnError?: boolean;
  overwrite?: boolean;
  createParentDirs?: boolean;
}