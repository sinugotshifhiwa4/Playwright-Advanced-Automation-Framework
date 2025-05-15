import fs from 'fs';
import path from 'path';
import {
  FileOperationOptions,
  FileOperationResult,
} from '../../models/utils/fileManager.interface';
import { FileEncoding } from '../../models/utils/fileEncoding.enum';
import ErrorHandler from '../../utils/errors/errorHandler';
import logger from '../logging/loggerManager';

export default class AsyncFileManager {
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
   * Checks if a directory exists
   *
   * @param dirPath - Path to the directory
   * @returns Promise resolving to boolean indicating existence
   */
  public static async doesDirectoryExist(dirPath: string): Promise<boolean> {
    dirPath = this.normalizePath(dirPath);
    this.validatePath(dirPath, 'dirPath');

    try {
      const stats = await fs.promises.stat(dirPath);
      return stats.isDirectory();
    } catch {
      logger.debug(`Directory does not exist: ${this.getRelativePath(dirPath)}`);
      return false;
    }
  }

  /**
   * Checks if a file exists
   *
   * @param filePath - Path to the file
   * @returns Promise resolving to boolean indicating existence
   */
  public static async doesFileExist(filePath: string): Promise<boolean> {
    filePath = this.normalizePath(filePath);
    this.validatePath(filePath, 'filePath');

    try {
      const stats = await fs.promises.stat(filePath);
      return stats.isFile();
    } catch {
      logger.debug(`File does not exist: ${path.basename(filePath)}`);
      return false;
    }
  }

  /**
   * Ensures a directory exists, creating it if necessary
   *
   * @param dirPath - Path to the directory
   * @param options - Operation options
   * @returns Promise with operation result
   */
  public static async ensureDirectoryExists(
    dirPath: string,
    options?: Partial<FileOperationOptions>,
  ): Promise<FileOperationResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    dirPath = this.normalizePath(dirPath);
    this.validatePath(dirPath, 'dirPath');

    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
      return { success: true };
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'ensureDirectoryExists',
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
   * Ensures a file exists, creating it if necessary.
   * Creates any parent directories that don't exist.
   *
   * @param filePath - Path to the file to ensure exists
   * @param options - Optional file operation options
   * @returns Promise resolving to a FileOperationResult indicating success or failure
   */
  public static async ensureFileExists(
    filePath: string,
    options?: Partial<FileOperationOptions>,
  ): Promise<FileOperationResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    filePath = this.normalizePath(filePath);
    this.validatePath(filePath, 'filePath');

    try {
      // First ensure parent directory exists
      const dirPath = path.dirname(filePath);
      const dirResult = await this.ensureDirectoryExists(dirPath, options);

      // If directory creation failed and we're not throwing, return the failure
      if (!dirResult.success) {
        return dirResult;
      }

      // Create or open the file in append mode, then close it
      const fileHandle = await fs.promises.open(filePath, 'a');
      await fileHandle.close();

      return { success: true };
    } catch (error) {
      ErrorHandler.captureError(error, 'ensureFileExists', `Failed to create file: ${filePath}`);

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
   * Reads content from a file
   *
   * @param filePath - Path to the file
   * @param encoding - File encoding
   * @returns Promise with file content
   */
  public static async readFile(
    filePath: string,
    encoding: FileEncoding = FileEncoding.UTF8,
  ): Promise<string> {
    filePath = this.normalizePath(filePath);
    this.validatePath(filePath, 'filePath');

    try {
      const content = await fs.promises.readFile(filePath, { encoding });
      logger.debug(`Successfully loaded file: ${this.getRelativePath(filePath)}`);
      return content.toString();
    } catch (error) {
      ErrorHandler.captureError(error, 'readFile', `Failed to read file: ${filePath}`);
      throw error;
    }
  }

  /**
   * Reads a file safely, returning a result object instead of throwing
   *
   * @param filePath - Path to the file
   * @param encoding - File encoding
   * @returns Promise with operation result containing file content
   */
  public static async readFileSafe(
    filePath: string,
    encoding: FileEncoding = FileEncoding.UTF8,
  ): Promise<FileOperationResult<string>> {
    try {
      const content = await this.readFile(filePath, encoding);
      return { success: true, data: content };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Writes content to a file with improved error handling and options
   *
   * @param filePath - Path to the file
   * @param content - Content to write
   * @param keyName - Identifier for logging
   * @param encoding - File encoding
   * @param options - Operation options
   * @returns Promise with operation result
   */
  public static async writeFile(
    filePath: string,
    content: string,
    keyName: string,
    encoding: FileEncoding = FileEncoding.UTF8,
    options?: Partial<FileOperationOptions>,
  ): Promise<FileOperationResult> {
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
        await this.ensureDirectoryExists(dirPath);
      }

      // Check if file exists and we're not supposed to overwrite
      if (!opts.overwrite) {
        const exists = await this.doesFileExist(filePath);
        if (exists) {
          const error = new Error(`File already exists and overwrite is disabled: ${filePath}`);

          if (opts.throwOnError) {
            throw error;
          }
          return { success: false, error };
        }
      }

      await fs.promises.writeFile(filePath, content, { encoding });

      logger.debug(`Successfully wrote file: ${this.getRelativePath(filePath)}`);
      return { success: true };
    } catch (error) {
      ErrorHandler.captureError(error, 'writeFile', `Failed to write file: ${filePath}`);

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
   * Appends content to a file
   *
   * @param filePath - Path to the file
   * @param content - Content to append
   * @param encoding - File encoding
   * @param options - Operation options
   * @returns Promise with operation result
   */
  public static async appendToFile(
    filePath: string,
    content: string,
    encoding: FileEncoding = FileEncoding.UTF8,
    options?: Partial<FileOperationOptions>,
  ): Promise<FileOperationResult> {
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
        await this.ensureDirectoryExists(dirPath, { throwOnError: false });
      }

      await fs.promises.appendFile(filePath, content, { encoding });

      logger.debug(`Successfully appended to file: ${this.getRelativePath(filePath)}`);
      return { success: true };
    } catch (error) {
      ErrorHandler.captureError(error, 'appendToFile', `Failed to append to file: ${filePath}`);

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
   * Removes a file
   *
   * @param filePath - Path to the file
   * @param options - Operation options
   * @returns Promise with operation result
   */
  public static async removeFile(
    filePath: string,
    options?: Partial<FileOperationOptions>,
  ): Promise<FileOperationResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    filePath = this.normalizePath(filePath);
    this.validatePath(filePath, 'filePath');

    try {
      await fs.promises.unlink(filePath);
      logger.debug(`Removed file: ${this.getRelativePath(filePath)}`);
      return { success: true };
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        logger.debug(`File does not exist for removal: ${filePath}`);
        return { success: false, error: new Error(`File not found: ${filePath}`) };
      }

      ErrorHandler.captureError(error, 'removeFile', `Failed to remove file: ${filePath}`);

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
   * Removes a directory
   *
   * @param dirPath - Path to the directory
   * @param options - Operation options
   * @returns Promise with operation result
   */
  public static async removeDirectory(
    dirPath: string,
    options?: Partial<FileOperationOptions>,
  ): Promise<FileOperationResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    dirPath = this.normalizePath(dirPath);
    this.validatePath(dirPath, 'dirPath');

    try {
      await fs.promises.rm(dirPath, { recursive: true, force: true });
      logger.debug(`Removed directory: ${this.getRelativePath(dirPath)}`);
      return { success: true };
    } catch (error) {
      ErrorHandler.captureError(error, 'removeDirectory', `Failed to remove directory: ${dirPath}`);

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
   * Copies a file from source to destination
   *
   * @param sourcePath - Source file path
   * @param destPath - Destination file path
   * @param options - Operation options
   * @returns Promise with operation result
   */
  public static async copyFile(
    sourcePath: string,
    destPath: string,
    options?: Partial<FileOperationOptions>,
  ): Promise<FileOperationResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    sourcePath = this.normalizePath(sourcePath);
    destPath = this.normalizePath(destPath);

    try {
      this.validatePath(sourcePath, 'sourcePath');
      this.validatePath(destPath, 'destPath');

      // Check if source exists
      const sourceExists = await this.doesFileExist(sourcePath);
      if (!sourceExists) {
        const error = new Error(`Source file does not exist: ${sourcePath}`);

        if (opts.throwOnError) {
          throw error;
        }
        return { success: false, error };
      }

      // Check if destination exists and we're not supposed to overwrite
      if (!opts.overwrite) {
        const destExists = await this.doesFileExist(destPath);
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
        await this.ensureDirectoryExists(destDir, { throwOnError: false });
      }

      await fs.promises.copyFile(
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
        'copyFile',
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
   * Moves a file from source to destination
   *
   * @param sourcePath - Source file path
   * @param destPath - Destination file path
   * @param options - Operation options
   * @returns Promise with operation result
   */
  public static async moveFile(
    sourcePath: string,
    destPath: string,
    options?: Partial<FileOperationOptions>,
  ): Promise<FileOperationResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    sourcePath = this.normalizePath(sourcePath);
    destPath = this.normalizePath(destPath);

    try {
      this.validatePath(sourcePath, 'sourcePath');
      this.validatePath(destPath, 'destPath');

      // Check if source exists
      const sourceExists = await this.doesFileExist(sourcePath);
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
        await this.ensureDirectoryExists(destDir, { throwOnError: false });
      }

      // Try using rename for atomic move (only works on same filesystem)
      try {
        await fs.promises.rename(sourcePath, destPath);
      } catch {
        // Fallback to copy and delete if rename fails
        const copyResult = await this.copyFile(sourcePath, destPath, opts);
        if (!copyResult.success) {
          return copyResult;
        }
        await this.removeFile(sourcePath, { throwOnError: false });
      }

      logger.debug(
        `Moved file from ${this.getRelativePath(sourcePath)} to ${this.getRelativePath(destPath)}`,
      );
      return { success: true };
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'moveFile',
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
   * Lists files in a directory
   *
   * @param dirPath - Path to the directory
   * @param options - Operation options
   * @returns Promise with operation result containing file list
   */
  public static async listFiles(
    dirPath: string,
    options?: Partial<FileOperationOptions>,
  ): Promise<FileOperationResult<string[]>> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    dirPath = this.normalizePath(dirPath);
    this.validatePath(dirPath, 'dirPath');

    try {
      const files = await fs.promises.readdir(dirPath);
      return { success: true, data: files };
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'listFiles',
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
   * Gets file stats
   *
   * @param filePath - Path to the file
   * @param options - Operation options
   * @returns Promise with operation result containing file stats
   */
  public static async getFileStats(
    filePath: string,
    options?: Partial<FileOperationOptions>,
  ): Promise<FileOperationResult<fs.Stats>> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    filePath = this.normalizePath(filePath);

    try {
      this.validatePath(filePath, 'filePath');
      const stats = await fs.promises.stat(filePath);
      return { success: true, data: stats };
    } catch (error) {
      ErrorHandler.captureError(error, 'getFileStats', `Failed to get file stats: ${filePath}`);

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
   * Resolves a given directory and fileName to an absolute normalized path with security checks
   *
   * @param directory - The directory path
   * @param fileName - The file or subpath to be appended to the directory
   * @returns Absolute normalized path
   */
  public static resolvePath(directory: string, fileName: string): string {
    if (!directory?.trim()) {
      throw new Error('Directory path cannot be empty');
    }
    if (!fileName?.trim()) {
      throw new Error('File name cannot be empty');
    }

    return path.resolve(directory, fileName);
  }

  public static getDirectoryPath(dirPath: string): string {
    try {
      this.validatePath(dirPath, 'dirPath');
      return this.resolvePath(process.cwd(), dirPath);
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'getDirPath',
        `Failed to resolve directory path: ${dirPath}`,
      );
      throw error;
    }
  }

  public static getFilePath(dirPath: string, fileName: string): string {
    try {
      this.validatePath(dirPath, 'directory');
      this.validatePath(fileName, 'fileName');

      const fullDirPath = this.getDirectoryPath(dirPath);
      return path.join(fullDirPath, fileName);
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'getFilePath',
        `Failed to construct file path for dirPath: '${dirPath}', fileName: '${fileName}'`,
      );
      throw error;
    }
  }
}
