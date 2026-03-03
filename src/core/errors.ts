import { JianwenDocument } from './ast';

export interface ParseError {
  message: string;
  line: number;
  column?: number;
  severity: 'error' | 'warning';
  code?: string;
}

export interface ParseResult {
  ast: JianwenDocument;
  errors: ParseError[];
}
