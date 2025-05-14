import fs from 'fs';
import path from 'path';
import {
  FileOperationOptions,
  FileOperationResult,
} from '../../models/utils/fileManager.interface';
import { FileEncoding } from '../../models/utils/fileEncoding.enum';
import ErrorHandler from '../../utils/errors/errorHandler';
import logger from '../logging/loggerManager';

export default class SyncFileManager {
  // Default options
  private static readonly DEFAULT_OPTIONS: FileOperationOptions = {
    throwOnError: true,
    overwrite: true,
    createParentDirs: true,
  };

  /**
   * Creates a read stream for large file operations
   * @param filePath - Path to the file
   * @returns ReadStream instance
   */
  public static createReadStream(filePath: string): fs.ReadStream {
    filePath = this.normalizePath(filePath);
    this.validatePath(filePath);
    return fs.createReadStream(filePath);
  }

  /**
   * Normalizes a path with security checks
   *
   * @param inputPath - The path to normalize
   * @returns Normalized absolute path
   */
  public static normalizePath(inputPath: string): string {
    if (!inputPath) {
      throw new Error('Path cannot be empty');
    }

    // Security: Check for null bytes (potential path traversal attack)
    if (inputPath.indexOf('\0') !== -1) {
      throw new Error('Path contains null bytes');
    }

    const normalizedPath = path.normalize(inputPath);

    // Convert to absolute path
    const absolutePath = path.resolve(normalizedPath);

    // Additional security check to prevent path traversal
    const cwd = process.cwd();
    if (!absolutePath.startsWith(cwd) && !path.isAbsolute(inputPath)) {
      throw new Error('Path traversal attempt detected');
    }

    return absolutePath;
  }

  /**
   * Gets a relative path from the current working directory
   *
   * @param absolutePath - The absolute path to convert
   * @returns Relative path from current working directory
   */
  public static getRelativePath(absolutePath: string): string {
    return path.relative(process.cwd(), absolutePath);
  }

  /**
   * Validates path parameters
   *
   * @param filePath - Path to validate
   * @param paramName - Parameter name for error messages
   */
  private static validatePath(filePath: string, paramName: string = 'path'): void {
    if (!filePath) {
      const message = `Invalid arguments: '${paramName}' is required.`;
      ErrorHandler.logAndThrow(message, 'validatePath');
    }

    if (paramName === 'filePath' && (filePath.endsWith('/') || filePath.endsWith('\\'))) {
      const message = `Invalid file path: '${filePath}' cannot end with a directory separator.`;
      ErrorHandler.logAndThrow(message, 'validatePath');
    }
  }

  /**
   * Checks if a directory exists (synchronous)
   *
   * @param dirPath - Path to the directory
   * @returns Boolean indicating existence
   */
  public static directoryExistsSync(dirPath: string): boolean {
    dirPath = this.normalizePath(dirPath);
    this.validatePath(dirPath, 'dirPath');

    try {
      const stats = fs.statSync(dirPath);
      return stats.isDirectory();
    } catch {
      logger.debug(`Directory does not exist: ${this.getRelativePath(dirPath)}`);
      return false;
    }
  }

  /**
   * Checks if a file exists (synchronous)
   *
   * @param filePath - Path to the file
   * @returns Boolean indicating existence
   */
  public static fileExistsSync(filePath: string): boolean {
    filePath = this.normalizePath(filePath);
    this.validatePath(filePath, 'filePath');

    try {
      const stats = fs.statSync(filePath);
      return stats.isFile();
    } catch {
      logger.debug(`File does not exist: ${path.basename(filePath)}`);
      return false;
    }
  }

  /**
   * Ensures a directory exists, creating it if necessary (synchronous)
   *
   * @param dirPath - Path to the directory
   * @param options - Operation options
   * @returns Operation result
   */
  public static ensureDirectoryExistsSync(
    dirPath: string,
    options?: Partial<FileOperationOptions>,
  ): FileOperationResult {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    dirPath = this.normalizePath(dirPath);
    this.validatePath(dirPath, 'dirPath');

    try {
      fs.mkdirSync(dirPath, { recursive: true });
      return { success: true };
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'ensureDirectoryExistsSync',
        `Failed to create directory: ${dirPath}`,
      );

      if (opts.throwOnError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Reads content from a file (synchronous)
   *
   * @param filePath - Path to the file
   * @param encoding - File encoding
   * @returns File content
   */
  public static readFileSync(filePath: string, encoding: FileEncoding = FileEncoding.UTF8): string {
    filePath = this.normalizePath(filePath);
    this.validatePath(filePath, 'filePath');

    try {
      const content = fs.readFileSync(filePath, { encoding });
      logger.debug(`Successfully loaded file: ${this.getRelativePath(filePath)}`);
      return content.toString();
    } catch (error) {
      ErrorHandler.captureError(error, 'readFileSync', `Failed to read file: ${filePath}`);
      throw error;
    }
  }

  /**
   * Reads a file safely, returning a result object instead of throwing (synchronous)
   *
   * @param filePath - Path to the file
   * @param encoding - File encoding
   * @returns Operation result containing file content
   */
  public static readFileSafeSync(
    filePath: string,
    encoding: FileEncoding = FileEncoding.UTF8,
  ): FileOperationResult<string> {
    try {
      const content = this.readFileSync(filePath, encoding);
      return { success: true, data: content };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Writes content to a file with improved error handling and options (synchronous)
   *
   * @param filePath - Path to the file
   * @param content - Content to write
   * @param keyName - Identifier for logging
   * @param encoding - File encoding
   * @param options - Operation options
   * @returns Operation result
   */
  public static writeFileSync(
    filePath: string,
    content: string,
    keyName: string,
    encoding: FileEncoding = FileEncoding.UTF8,
    options?: Partial<FileOperationOptions>,
  ): FileOperationResult {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    filePath = this.normalizePath(filePath);

    try {
      this.validatePath(filePath, 'filePath');

      if (content === undefined || content === null) {
        const error = new Error(`No content provided for file: ${keyName}`);
        logger.warn(error.message);

        if (opts.throwOnError) {
          throw error;
        }
        return { success: false, error };
      }

      const dirPath = path.dirname(filePath);

      if (opts.createParentDirs) {
        this.ensureDirectoryExistsSync(dirPath);
      }

      // Check if file exists and we're not supposed to overwrite
      if (!opts.overwrite) {
        const exists = this.fileExistsSync(filePath);
        if (exists) {
          const error = new Error(`File already exists and overwrite is disabled: ${filePath}`);

          if (opts.throwOnError) {
            throw error;
          }
          return { success: false, error };
        }
      }

      fs.writeFileSync(filePath, content, { encoding });

      logger.debug(`Successfully wrote file: ${this.getRelativePath(filePath)}`);
      return { success: true };
    } catch (error) {
      ErrorHandler.captureError(error, 'writeFileSync', `Failed to write file: ${filePath}`);

      if (opts.throwOnError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Appends content to a file (synchronous)
   *
   * @param filePath - Path to the file
   * @param content - Content to append
   * @param encoding - File encoding
   * @param options - Operation options
   * @returns Operation result
   */
  public static appendToFileSync(
    filePath: string,
    content: string,
    encoding: FileEncoding = FileEncoding.UTF8,
    options?: Partial<FileOperationOptions>,
  ): FileOperationResult {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    filePath = this.normalizePath(filePath);

    try {
      this.validatePath(filePath, 'filePath');

      if (!content) {
        const error = new Error('No content provided for append operation');
        logger.warn(error.message);

        if (opts.throwOnError) {
          throw error;
        }
        return { success: false, error };
      }

      const dirPath = path.dirname(filePath);

      if (opts.createParentDirs) {
        this.ensureDirectoryExistsSync(dirPath);
      }

      fs.appendFileSync(filePath, content, { encoding });

      logger.debug(`Successfully appended to file: ${this.getRelativePath(filePath)}`);
      return { success: true };
    } catch (error) {
      ErrorHandler.captureError(error, 'appendToFileSync', `Failed to append to file: ${filePath}`);

      if (opts.throwOnError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Removes a file (synchronous)
   *
   * @param filePath - Path to the file
   * @param options - Operation options
   * @returns Operation result
   */
  public static removeFileSync(
    filePath: string,
    options?: Partial<FileOperationOptions>,
  ): FileOperationResult {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    filePath = this.normalizePath(filePath);
    this.validatePath(filePath, 'filePath');

    try {
      fs.unlinkSync(filePath);
      logger.debug(`Removed file: ${this.getRelativePath(filePath)}`);
      return { success: true };
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        logger.debug(`File does not exist for removal: ${filePath}`);
        return { success: false, error: new Error(`File not found: ${filePath}`) };
      }

      ErrorHandler.captureError(error, 'removeFileSync', `Failed to remove file: ${filePath}`);

      if (opts.throwOnError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Removes a directory (synchronous)
   *
   * @param dirPath - Path to the directory
   * @param options - Operation options
   * @returns Operation result
   */
  public static removeDirectorySync(
    dirPath: string,
    options?: Partial<FileOperationOptions>,
  ): FileOperationResult {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    dirPath = this.normalizePath(dirPath);
    this.validatePath(dirPath, 'dirPath');

    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      logger.debug(`Removed directory: ${this.getRelativePath(dirPath)}`);
      return { success: true };
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'removeDirectorySync',
        `Failed to remove directory: ${dirPath}`,
      );

      if (opts.throwOnError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Copies a file from source to destination (synchronous)
   *
   * @param sourcePath - Source file path
   * @param destPath - Destination file path
   * @param options - Operation options
   * @returns Operation result
   */
  public static copyFileSync(
    sourcePath: string,
    destPath: string,
    options?: Partial<FileOperationOptions>,
  ): FileOperationResult {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    sourcePath = this.normalizePath(sourcePath);
    destPath = this.normalizePath(destPath);

    try {
      this.validatePath(sourcePath, 'sourcePath');
      this.validatePath(destPath, 'destPath');

      // Check if source exists
      const sourceExists = this.fileExistsSync(sourcePath);
      if (!sourceExists) {
        const error = new Error(`Source file does not exist: ${sourcePath}`);

        if (opts.throwOnError) {
          throw error;
        }
        return { success: false, error };
      }

      // Check if destination exists and we're not supposed to overwrite
      if (!opts.overwrite) {
        const destExists = this.fileExistsSync(destPath);
        if (destExists) {
          const error = new Error(`Destination file already exists: ${destPath}`);

          if (opts.throwOnError) {
            throw error;
          }
          return { success: false, error };
        }
      }

      // Create destination directory if needed
      if (opts.createParentDirs) {
        const destDir = path.dirname(destPath);
        this.ensureDirectoryExistsSync(destDir);
      }

      fs.copyFileSync(
        sourcePath,
        destPath,
        opts.overwrite ? fs.constants.COPYFILE_FICLONE : fs.constants.COPYFILE_EXCL,
      );

      logger.debug(
        `Copied file from ${this.getRelativePath(sourcePath)} to ${this.getRelativePath(destPath)}`,
      );
      return { success: true };
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'copyFileSync',
        `Failed to copy file from ${sourcePath} to ${destPath}`,
      );

      if (opts.throwOnError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Moves a file from source to destination (synchronous)
   *
   * @param sourcePath - Source file path
   * @param destPath - Destination file path
   * @param options - Operation options
   * @returns Operation result
   */
  public static moveFileSync(
    sourcePath: string,
    destPath: string,
    options?: Partial<FileOperationOptions>,
  ): FileOperationResult {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    sourcePath = this.normalizePath(sourcePath);
    destPath = this.normalizePath(destPath);

    try {
      this.validatePath(sourcePath, 'sourcePath');
      this.validatePath(destPath, 'destPath');

      // Check if source exists
      const sourceExists = this.fileExistsSync(sourcePath);
      if (!sourceExists) {
        const error = new Error(`Source file does not exist: ${sourcePath}`);

        if (opts.throwOnError) {
          throw error;
        }
        return { success: false, error };
      }

      // Create destination directory if needed
      if (opts.createParentDirs) {
        const destDir = path.dirname(destPath);
        this.ensureDirectoryExistsSync(destDir);
      }

      // Try using rename for atomic move
      try {
        fs.renameSync(sourcePath, destPath);
      } catch {
        // Fallback to copy and delete if rename fails
        const copyResult = this.copyFileSync(sourcePath, destPath, opts);
        if (!copyResult.success) {
          return copyResult;
        }
        this.removeFileSync(sourcePath, { throwOnError: false });
      }

      logger.debug(
        `Moved file from ${this.getRelativePath(sourcePath)} to ${this.getRelativePath(destPath)}`,
      );
      return { success: true };
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'moveFileSync',
        `Failed to move file from ${sourcePath} to ${destPath}`,
      );

      if (opts.throwOnError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Lists files in a directory (synchronous)
   *
   * @param dirPath - Path to the directory
   * @param options - Operation options
   * @returns Operation result containing file list
   */
  public static listFilesSync(
    dirPath: string,
    options?: Partial<FileOperationOptions>,
  ): FileOperationResult<string[]> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    dirPath = this.normalizePath(dirPath);
    this.validatePath(dirPath, 'dirPath');

    try {
      const files = fs.readdirSync(dirPath);
      return { success: true, data: files };
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'listFilesSync',
        `Failed to list files in directory: ${dirPath}`,
      );

      if (opts.throwOnError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Gets file stats (synchronous)
   *
   * @param filePath - Path to the file
   * @param options - Operation options
   * @returns Operation result containing file stats
   */
  public static getFileStatsSync(
    filePath: string,
    options?: Partial<FileOperationOptions>,
  ): FileOperationResult<fs.Stats> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    filePath = this.normalizePath(filePath);

    try {
      this.validatePath(filePath, 'filePath');
      const stats = fs.statSync(filePath);
      return { success: true, data: stats };
    } catch (error) {
      ErrorHandler.captureError(error, 'getFileStatsSync', `Failed to get file stats: ${filePath}`);

      if (opts.throwOnError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Core existsSync method to check if a path exists
   *
   * @param targetPath - Path to check
   * @returns Boolean indicating if path exists
   */
  public static existsSync(targetPath: string): boolean {
    targetPath = this.normalizePath(targetPath);
    this.validatePath(targetPath);

    try {
      return fs.existsSync(targetPath);
    } catch (error) {
      logger.debug(`Error checking if path exists: ${targetPath}. error: ${error}`);
      return false;
    }
  }

  /**
   * Setup a file watcher (synchronous wrapper for async fs.watch)
   * Note: Although this method name is sync, file watching is inherently asynchronous
   *
   * @param filePath - Path to the file to watch
   * @param onChange - Callback function when file changes
   */
  public static fileWatcher(filePath: string, onChange: () => void): void {
    try {
      fs.watch(filePath, (eventType) => {
        if (eventType === 'change') {
          onChange();
        }
      });
      logger.info(`Watching for changes in ${path.basename(filePath)}`);
    } catch (error) {
      logger.warn(`Failed to watch file ${filePath}: ${error}`);
    }
  }
}
