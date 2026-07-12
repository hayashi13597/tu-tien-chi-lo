// Deliberately has no HTTP status: status codes are an HTTP/presentation
// concept. presentation/middleware/errorHandler.ts maps `code` to a status,
// keeping domain/application free of any HTTP-layer knowledge.
export class DomainError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'DomainError';
  }
}
