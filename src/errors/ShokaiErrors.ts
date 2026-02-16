/**
 * ShokaiShelf Custom Error System
 * Provides standardized error codes and messages for better debugging and user feedback
 */

export enum ErrorCode {
  // Authentication Errors (1xxx)
  AUTH_TOKEN_MISSING = 'SHOKAI_1001',
  AUTH_TOKEN_INVALID = 'SHOKAI_1002',
  AUTH_TOKEN_EXPIRED = 'SHOKAI_1003',
  AUTH_NOT_AUTHENTICATED = 'SHOKAI_1004',
  AUTH_PERMISSION_DENIED = 'SHOKAI_1005',

  // Network Errors (2xxx)
  NETWORK_HTTP_ERROR = 'SHOKAI_2001',
  NETWORK_TIMEOUT = 'SHOKAI_2002',
  NETWORK_OFFLINE = 'SHOKAI_2003',
  NETWORK_RATE_LIMITED = 'SHOKAI_2004',
  NETWORK_INVALID_RESPONSE = 'SHOKAI_2005',

  // AniList API Errors (3xxx)
  ANILIST_GRAPHQL_ERROR = 'SHOKAI_3001',
  ANILIST_MUTATION_FAILED = 'SHOKAI_3002',
  ANILIST_QUERY_FAILED = 'SHOKAI_3003',
  ANILIST_INVALID_DATA = 'SHOKAI_3004',

  // Database/Storage Errors (4xxx)
  DB_CORRUPTED_DATA = 'SHOKAI_4001',
  DB_WRITE_FAILED = 'SHOKAI_4002',
  DB_READ_FAILED = 'SHOKAI_4003',
  STORAGE_QUOTA_EXCEEDED = 'SHOKAI_4004',

  // Sync Errors (5xxx)
  SYNC_QUEUE_FAILED = 'SHOKAI_5001',
  SYNC_CONFLICT = 'SHOKAI_5002',
  SYNC_INVALID_PAYLOAD = 'SHOKAI_5003',
  SYNC_MAX_RETRIES = 'SHOKAI_5004',

  // Validation Errors (6xxx)
  VALIDATION_INVALID_INPUT = 'SHOKAI_6001',
  VALIDATION_MISSING_FIELD = 'SHOKAI_6002',
  VALIDATION_OUT_OF_RANGE = 'SHOKAI_6003',
  VALIDATION_MALFORMED_JSON = 'SHOKAI_6004',

  // Media/Content Errors (7xxx)
  MEDIA_NOT_FOUND = 'SHOKAI_7001',
  MEDIA_LOAD_FAILED = 'SHOKAI_7002',
  MEDIA_INVALID_FORMAT = 'SHOKAI_7003',
  MEDIA_XSS_DETECTED = 'SHOKAI_7004',

  // Notification Errors (8xxx)
  NOTIF_ENGINE_FAILED = 'SHOKAI_8001',
  NOTIF_SEND_FAILED = 'SHOKAI_8002',
  NOTIF_INVALID_CONFIG = 'SHOKAI_8003',

  // General Errors (9xxx)
  UNKNOWN_ERROR = 'SHOKAI_9000',
  INTERNAL_ERROR = 'SHOKAI_9001',
  NOT_IMPLEMENTED = 'SHOKAI_9002',
}

export interface ShokaiErrorContext {
  httpStatus?: number;
  endpoint?: string;
  mediaId?: number;
  userId?: string;
  operation?: string;
  originalError?: Error | unknown;
  retryable?: boolean;
  [key: string]: any;
}

/**
 * Base custom error class for ShokaiShelf
 */
export class ShokaiError extends Error {
  public readonly code: ErrorCode;
  public readonly context: ShokaiErrorContext;
  public readonly timestamp: Date;
  public readonly userMessage: string;

  constructor(
    code: ErrorCode,
    message: string,
    userMessage?: string,
    context: ShokaiErrorContext = {}
  ) {
    super(message);
    this.name = 'ShokaiError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
    this.userMessage = userMessage || this.getDefaultUserMessage(code);

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ShokaiError);
    }
  }

  private getDefaultUserMessage(code: ErrorCode): string {
    const messages: Record<ErrorCode, string> = {
      // Auth
      [ErrorCode.AUTH_TOKEN_MISSING]: 'Please log in to AniList to continue.',
      [ErrorCode.AUTH_TOKEN_INVALID]: 'Your session is invalid. Please log in again.',
      [ErrorCode.AUTH_TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
      [ErrorCode.AUTH_NOT_AUTHENTICATED]: 'Authentication required.',
      [ErrorCode.AUTH_PERMISSION_DENIED]: 'You do not have permission to perform this action.',

      // Network
      [ErrorCode.NETWORK_HTTP_ERROR]: 'Network request failed. Please check your connection.',
      [ErrorCode.NETWORK_TIMEOUT]: 'Request timed out. Please try again.',
      [ErrorCode.NETWORK_OFFLINE]: 'You are offline. Changes will sync when connection is restored.',
      [ErrorCode.NETWORK_RATE_LIMITED]: 'Too many requests. Please wait a moment.',
      [ErrorCode.NETWORK_INVALID_RESPONSE]: 'Received invalid response from server.',

      // AniList
      [ErrorCode.ANILIST_GRAPHQL_ERROR]: 'AniList API error. Please try again later.',
      [ErrorCode.ANILIST_MUTATION_FAILED]: 'Failed to save changes to AniList.',
      [ErrorCode.ANILIST_QUERY_FAILED]: 'Failed to fetch data from AniList.',
      [ErrorCode.ANILIST_INVALID_DATA]: 'Received invalid data from AniList.',

      // Database
      [ErrorCode.DB_CORRUPTED_DATA]: 'Local data is corrupted. Please restart the app.',
      [ErrorCode.DB_WRITE_FAILED]: 'Failed to save data locally.',
      [ErrorCode.DB_READ_FAILED]: 'Failed to read local data.',
      [ErrorCode.STORAGE_QUOTA_EXCEEDED]: 'Storage quota exceeded. Please free up space.',

      // Sync
      [ErrorCode.SYNC_QUEUE_FAILED]: 'Failed to sync changes. Will retry automatically.',
      [ErrorCode.SYNC_CONFLICT]: 'Sync conflict detected. Please refresh your data.',
      [ErrorCode.SYNC_INVALID_PAYLOAD]: 'Invalid sync data detected.',
      [ErrorCode.SYNC_MAX_RETRIES]: 'Sync failed after multiple attempts. Please try manually.',

      // Validation
      [ErrorCode.VALIDATION_INVALID_INPUT]: 'Invalid input provided.',
      [ErrorCode.VALIDATION_MISSING_FIELD]: 'Required field is missing.',
      [ErrorCode.VALIDATION_OUT_OF_RANGE]: 'Value is out of acceptable range.',
      [ErrorCode.VALIDATION_MALFORMED_JSON]: 'Data format is invalid.',

      // Media
      [ErrorCode.MEDIA_NOT_FOUND]: 'Media not found.',
      [ErrorCode.MEDIA_LOAD_FAILED]: 'Failed to load media content.',
      [ErrorCode.MEDIA_INVALID_FORMAT]: 'Media format is not supported.',
      [ErrorCode.MEDIA_XSS_DETECTED]: 'Potentially unsafe content detected and blocked.',

      // Notifications
      [ErrorCode.NOTIF_ENGINE_FAILED]: 'Notification system error.',
      [ErrorCode.NOTIF_SEND_FAILED]: 'Failed to send notification.',
      [ErrorCode.NOTIF_INVALID_CONFIG]: 'Notification configuration is invalid.',

      // General
      [ErrorCode.UNKNOWN_ERROR]: 'An unknown error occurred.',
      [ErrorCode.INTERNAL_ERROR]: 'Internal error. Please report this issue.',
      [ErrorCode.NOT_IMPLEMENTED]: 'This feature is not yet implemented.',
    };

    return messages[code] || 'An error occurred.';
  }

  /**
   * Convert error to JSON for logging
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }

  /**
   * Get a formatted error message for display
   */
  getDisplayMessage(): string {
    return `[${this.code}] ${this.userMessage}`;
  }

  /**
   * Check if this error is retryable
   */
  isRetryable(): boolean {
    return this.context.retryable ?? this.isRetryableByCode();
  }

  private isRetryableByCode(): boolean {
    const retryableCodes = [
      ErrorCode.NETWORK_TIMEOUT,
      ErrorCode.NETWORK_OFFLINE,
      ErrorCode.NETWORK_RATE_LIMITED,
      ErrorCode.ANILIST_GRAPHQL_ERROR,
      ErrorCode.SYNC_QUEUE_FAILED,
    ];
    return retryableCodes.includes(this.code);
  }
}

/**
 * Factory functions for common error types
 */
export class ShokaiErrorFactory {
  static httpError(status: number, statusText: string, endpoint?: string): ShokaiError {
    let code: ErrorCode;
    let retryable = false;

    switch (status) {
      case 401:
      case 403:
        code = ErrorCode.AUTH_PERMISSION_DENIED;
        break;
      case 429:
        code = ErrorCode.NETWORK_RATE_LIMITED;
        retryable = true;
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        code = ErrorCode.NETWORK_HTTP_ERROR;
        retryable = true;
        break;
      default:
        code = ErrorCode.NETWORK_HTTP_ERROR;
    }

    return new ShokaiError(
      code,
      `HTTP ${status}: ${statusText}`,
      undefined,
      { httpStatus: status, endpoint, retryable }
    );
  }

  static graphqlError(message: string, endpoint?: string): ShokaiError {
    return new ShokaiError(
      ErrorCode.ANILIST_GRAPHQL_ERROR,
      `GraphQL Error: ${message}`,
      undefined,
      { endpoint, retryable: true }
    );
  }

  static jsonParseError(source: string, originalError: unknown): ShokaiError {
    return new ShokaiError(
      ErrorCode.VALIDATION_MALFORMED_JSON,
      `Failed to parse JSON from ${source}`,
      'Data format error. This item will be skipped.',
      { source, originalError, retryable: false }
    );
  }

  static authError(reason: string): ShokaiError {
    return new ShokaiError(
      ErrorCode.AUTH_NOT_AUTHENTICATED,
      `Authentication failed: ${reason}`,
      undefined,
      { retryable: false }
    );
  }

  static syncError(operation: string, originalError: unknown): ShokaiError {
    return new ShokaiError(
      ErrorCode.SYNC_QUEUE_FAILED,
      `Sync operation failed: ${operation}`,
      undefined,
      { operation, originalError, retryable: true }
    );
  }

  static notificationError(reason: string, originalError?: unknown): ShokaiError {
    return new ShokaiError(
      ErrorCode.NOTIF_ENGINE_FAILED,
      `Notification error: ${reason}`,
      undefined,
      { originalError, retryable: true }
    );
  }

  static mediaLoadError(url: string, status?: number): ShokaiError {
    return new ShokaiError(
      ErrorCode.MEDIA_LOAD_FAILED,
      `Failed to load media from ${url}`,
      'Failed to load image. It will be skipped.',
      { url, httpStatus: status, retryable: true }
    );
  }
}
