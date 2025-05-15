import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import SecureKeyGenerator from '../keyManagement/secureKeyGenerator';
import { CRYPTO_CONFIG } from '../../models/utils/encryption.interface';
import { EncryptionParameters } from '../../models/utils/encryption.interface';
import { FileEncoding } from '../../models/utils/fileEncoding.enum';
import ErrorHandler from '../../utils/errors/errorHandler';

export default class EncryptionService {
  /**
   * Encrypts a given string value using the AES-GCM algorithm.
   *
   * This method takes a secret key and uses it to derive a key using Argon2id,
   * then uses the derived key to encrypt the value using AES-GCM. The salt and
   * IV used for the derivation and encryption operations are generated randomly
   * and returned as part of the result.
   *
   * @param {string} value - The string value to encrypt.
   * @param {string} secretKey - The secret key to use for derivation.
   * @returns {Promise<EncryptionParameters>} A promise that resolves to an object
   *   with the following properties: `salt`, `iv` and `cipherText`, representing
   *   the salt used for the derivation, the IV used for the encryption, and the
   *   encrypted value, respectively.
   * @throws {Error} If an error occurs during the derivation or encryption
   *   operations.
   */
  public static async encrypt(value: string, secretKey: string): Promise<EncryptionParameters> {
    try {
      // Generate random salt and IV
      const salt = SecureKeyGenerator.generateBase64Salt();
      const webCryptoIv = SecureKeyGenerator.generateWebCryptoIV();

      // Derive a key using Argon2
      const key = await this.deriveKeyWithArgon2(secretKey, salt);

      // Encrypt the value using AES-GCM
      const encryptedBuffer = await this.encryptBuffer(webCryptoIv, key, value);

      return {
        salt,
        iv: Buffer.from(webCryptoIv).toString(FileEncoding.BASE64),
        cipherText: Buffer.from(encryptedBuffer).toString(FileEncoding.BASE64),
      };
    } catch (error) {
      ErrorHandler.captureError(error, 'encrypt', 'Failed to encrypt with AES-GCM.');
      throw error;
    }
  }

  private static createTextEncoder(): TextEncoder {
    return new TextEncoder();
  }

  /**
   * Encrypts a given string value using the AES-GCM algorithm.
   *
   * @param webCryptoIv - The initialization vector to use for encryption as a Uint8Array.
   * @param key - The CryptoKey object representing the secret key to use for encryption.
   * @param value - The plaintext string to encrypt.
   * @returns A Promise that resolves to an ArrayBuffer containing the encrypted data.
   * @throws Will handle and throw an error if the encryption process fails.
   */

  private static async encryptBuffer(
    webCryptoIv: Uint8Array,
    key: CryptoKey,
    value: string,
  ): Promise<ArrayBuffer> {
    try {
      // Encrypt the value using AES-GCM
      const textEncoder = this.createTextEncoder();

      return await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: webCryptoIv,
        },
        key,
        textEncoder.encode(value),
      );
    } catch (error) {
      ErrorHandler.captureError(error, 'encrypt', 'Failed to encrypt with AES-GCM.');
      throw error;
    }
  }

  /**
   * Decrypts a given encrypted string using the provided secret key.
   *
   * This function derives the key using Argon2, decrypts the ciphertext using AES-GCM, and
   * then decodes the decrypted plaintext as a UTF-8 string.
   *
   * @param encryptedData - The encrypted string to decrypt.
   * @param secretKey - The secret key to use for decryption.
   * @returns A promise that resolves to the decrypted string.
   * @throws Will throw an error if the decryption fails.
   */
  public static async decrypt(encryptedData: string, secretKey: string): Promise<string> {
    try {
      const parsedData = this.parseEncryptedData(encryptedData);
      const { salt, iv, cipherText } = parsedData;

      // Derive the key using Argon2
      const key = await this.deriveKeyWithArgon2(secretKey, salt);

      // Convert base64 IV and ciphertext back to Uint8Array
      const ivBuffer = Buffer.from(iv, FileEncoding.BASE64);
      const cipherBuffer = Buffer.from(cipherText, FileEncoding.BASE64);

      // Decrypt using AES-GCM
      const decryptedBuffer = await this.decryptBuffer(ivBuffer, key, cipherBuffer);

      return new TextDecoder().decode(decryptedBuffer);
    } catch (error) {
      ErrorHandler.captureError(error, 'decrypt', 'Failed to decrypt with AES-GCM.');
      throw error;
    }
  }

  /**
   * Decrypts an array of encrypted data strings using a secret key.
   *
   * This function decrypts each string in the given array concurrently using the provided secret key.
   * If decryption fails for any string, an error is logged and handled.
   *
   * @param encryptedDataArray - An array of encrypted string data to be decrypted.
   * @param secretKey - The secret key used for decryption.
   * @returns A promise that resolves to an array of decrypted strings.
   * @throws Will handle and log errors if decryption of any data fails.
   */
  public static async decryptMultipleKeys(
    encryptedDataArray: string[],
    secretKey: string,
  ): Promise<string[]> {
    try {
      // Use Promise.all to decrypt all strings concurrently
      return await Promise.all(encryptedDataArray.map((data) => this.decrypt(data, secretKey)));
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'decryptMultiple',
        'Failed to decrypt multiple values with AES-GCM.',
      );
      throw error;
    }
  }

  /**
   * Decrypts a given ciphertext buffer using the provided key.
   *
   * @param ivBuffer The initialization vector to use for decryption.
   * @param key The secret key to use for decryption.
   * @param cipherBuffer The ciphertext to decrypt.
   * @returns A promise that resolves to the decrypted plaintext ArrayBuffer.
   * @throws Will throw an error if the decryption fails.
   */
  private static async decryptBuffer(
    ivBuffer: Uint8Array,
    key: CryptoKey,
    cipherBuffer: Uint8Array,
  ): Promise<ArrayBuffer> {
    try {
      return await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivBuffer,
        },
        key,
        cipherBuffer,
      );
    } catch (error) {
      ErrorHandler.captureError(error, 'decrypt', 'Failed to decrypt with AES-GCM.');
      throw error;
    }
  }

  /**
   * Derives a key using the Argon2id algorithm.
   *
   * Uses the secret key and provided salt to generate a key with the given hash length.
   * The key is then imported into the Web Crypto API for use in cryptographic operations.
   *
   * @param secretKey The secret key to use for key derivation.
   * @param salt The salt to use for key derivation.
   * @returns A promise that resolves to the derived key as a CryptoKey object.
   * @throws Will throw an error if key derivation fails.
   */
  private static async deriveKeyWithArgon2(secretKey: string, salt: string): Promise<CryptoKey> {
    try {
      const options = {
        type: argon2.argon2id,
        hashLength: CRYPTO_CONFIG.BYTE_LENGTHS.SECRET_KEY,
        salt: Buffer.from(salt, FileEncoding.BASE64),
        memoryCost: CRYPTO_CONFIG.ARGON2_PARAMETERS.MEMORY_COST,
        timeCost: CRYPTO_CONFIG.ARGON2_PARAMETERS.TIME_COST,
        parallelism: CRYPTO_CONFIG.ARGON2_PARAMETERS.PARALLELISM,
        raw: true,
      };

      const keyBuffer = await this.argon2Hashing(secretKey, options);

      // Import the key into Web Crypto API
      return await this.importKeyForCrypto(keyBuffer);
    } catch (error) {
      ErrorHandler.captureError(error, 'deriveKeyWithArgon2', 'Failed to derive key.');
      throw error;
    }
  }

  /**
   * Uses the Argon2id algorithm to hash the given secret key with the given options and returns the
   * resulting Buffer. If the hashing fails, an error is logged and handled.
   * @param secretKey The secret key to hash.
   * @param options The options to use for the Argon2id hashing.
   * @returns A promise that resolves to the resulting Buffer.
   * @throws Will log and handle errors if the hashing fails.
   */
  private static async argon2Hashing(secretKey: string, options: argon2.Options): Promise<Buffer> {
    try {
      const keyBuffer = await argon2.hash(secretKey, {
        ...options,
        raw: true,
      });
      return keyBuffer;
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'argon2Hashing',
        'Failed to derive key using Argon2 hashing.',
      );
      throw error;
    }
  }

  /**
   * Imports the given key Buffer into the Web Crypto API for use with AES-GCM
   * encryption/decryption. If the import fails, an error is logged and handled.
   * @param keyBuffer The key Buffer to import.
   * @returns A promise that resolves to the imported CryptoKey.
   * @throws Will log and handle errors if the import fails.
   */
  private static async importKeyForCrypto(keyBuffer: Buffer): Promise<CryptoKey> {
    try {
      return await crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-GCM' }, false, [
        'encrypt',
        'decrypt',
      ]);
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'importKeyForCrypto',
        'Failed to import key for Web Crypto API.',
      );
      throw error;
    }
  }

  /**
   * Parses and validates the given encrypted data.
   * @param encryptedData The encrypted data to parse.
   * @returns The parsed and validated encryption parameters.
   * @throws {Error} If the encrypted data is empty or invalid.
   */
  private static parseEncryptedData(encryptedData: string): EncryptionParameters {
    try {
      if (!encryptedData) {
        ErrorHandler.logAndThrow('Encrypted data is required.', 'parseEncryptedData');
      }

      const parsedData = JSON.parse(encryptedData) as EncryptionParameters;
      this.validateParsedData(parsedData);

      return parsedData;
    } catch (error) {
      ErrorHandler.captureError(error, 'parseEncryptedData', 'Failed to parse encrypted data');
      throw error;
    }
  }

  /**
   * Validates the parsed encryption parameters to ensure all required properties are present.
   * @param params The encryption parameters to validate.
   * @throws {Error} If any required properties are missing.
   */
  private static validateParsedData(params: EncryptionParameters): void {
    try {
      const { salt, iv, cipherText } = params;
      if (!salt || !iv || !cipherText) {
        ErrorHandler.logAndThrow(
          'Missing required properties in encryption parameters.',
          'validateParsedData',
        );
      }
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'validateParsedData',
        'Failed to validate encryption parameters.',
      );
      throw error;
    }
  }
}
