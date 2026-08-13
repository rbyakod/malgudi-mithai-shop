export const ErrorCode = {
  RATE_LIMITED: 'RATE_LIMITED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_PROVIDER_DOWN: 'OTP_PROVIDER_DOWN',
  PINCODE_NOT_SERVICEABLE: 'PINCODE_NOT_SERVICEABLE',
  CART_CHANGED: 'CART_CHANGED',
  STOCK_INSUFFICIENT: 'STOCK_INSUFFICIENT',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_ABANDONED: 'PAYMENT_ABANDONED',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  CONFLICT: 'CONFLICT',
  VALIDATION: 'VALIDATION',
  INTERNAL: 'INTERNAL',
} as const;
export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

const STATUS_CODES: Record<ErrorCode, number> = {
  RATE_LIMITED: 429,
  OTP_INVALID: 400,
  OTP_EXPIRED: 410,
  OTP_PROVIDER_DOWN: 503,
  PINCODE_NOT_SERVICEABLE: 422,
  CART_CHANGED: 409,
  STOCK_INSUFFICIENT: 409,
  PAYMENT_FAILED: 402,
  PAYMENT_ABANDONED: 422,
  ORDER_NOT_FOUND: 404,
  PRODUCT_NOT_FOUND: 404,
  INVALID_STATE_TRANSITION: 409,
  TOKEN_EXPIRED: 401,
  TOKEN_REVOKED: 401,
  CONFLICT: 409,
  VALIDATION: 422,
  INTERNAL: 500,
};

export class ApiError extends Error {
  readonly statusCode: number;
  readonly traceId: string;
  readonly fieldErrors?: Record<string, string>;
  readonly retryable: boolean;

  constructor(public code: ErrorCode, message: string, opts: { fieldErrors?: Record<string, string>; retryable?: boolean; traceId?: string } = {}) {
    super(message);
    this.statusCode = STATUS_CODES[code];
    this.traceId = opts.traceId ?? 'none';
    this.fieldErrors = opts.fieldErrors;
    this.retryable = opts.retryable ?? false;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        fieldErrors: this.fieldErrors,
        traceId: this.traceId,
      },
    };
  }
}
