/**
 * ShokaiShelf Custom Error System (Electron Main Process)
 * Mirror of src/errors/ShokaiErrors.ts for use in Electron main process
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

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ShokaiError);
    }
  }

  private getDefaultUserMessage(code: ErrorCode): string {
    const messages: Partial<Record<ErrorCode, string>> = {
      [ErrorCode.AUTH_PERMISSION_DENIED]: 'Authentication failed. Please log in again.',
      [ErrorCode.NETWORK_HTTP_ERROR]: 'Network request failed.',
      [ErrorCode.NETWORK_RATE_LIMITED]: 'Rate limited. Please wait.',
      [ErrorCode.ANILIST_GRAPHQL_ERROR]: 'AniList API error.',
      [ErrorCode.ANILIST_MUTATION_FAILED]: 'Failed to save to AniList.',
      [ErrorCode.DB_CORRUPTED_DATA]: 'Corrupted data detected.',
      [ErrorCode.SYNC_QUEUE_FAILED]: 'Sync failed. Will retry.',
      [ErrorCode.VALIDATION_MALFORMED_JSON]: 'Invalid data format.',
      [ErrorCode.NOTIF_ENGINE_FAILED]: 'Notification system error.',
    };

    return messages[code] || 'An error occurred.';
  }

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

  getDisplayMessage(): string {
    return `[${this.code}] ${this.userMessage}`;
  }

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
      'Failed to load image.',
      { url, httpStatus: status, retryable: true }
    );
  }
}
