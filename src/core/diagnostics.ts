import { ParseError } from './errors';

export type ParseErrorSeverity = ParseError['severity'];

export interface ParseErrorInput {
  message: string;
  line: number;
  column?: number;
  code?: string;
}

export function buildParseError(input: ParseErrorInput, severity: ParseErrorSeverity): ParseError {
  return {
    message: input.message,
    line: input.line,
    column: input.column,
    severity,
    code: input.code,
  };
}

export function reportParseError(errors: ParseError[], input: ParseErrorInput): void {
  errors.push(buildParseError(input, 'error'));
}

export function reportParseWarning(errors: ParseError[], input: ParseErrorInput): void {
  errors.push(buildParseError(input, 'warning'));
}

export function prefixIncludeError(error: ParseError, target: string): ParseError {
  return { ...error, message: `[include:${target}] ${error.message}` };
}
