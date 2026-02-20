export class CliError extends Error {
  readonly code: number;

  constructor(message: string, code = 2) {
    super(message);
    this.name = 'CliError';
    this.code = code;
  }
}
