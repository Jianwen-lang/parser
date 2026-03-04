import { BlockAttributes } from '../ast';
import { SourceLocation } from '../location';

export interface PendingBlockContext {
  attrs?: BlockAttributes;
  anchorLocation?: SourceLocation;
  foldNext: boolean;
  tagName?: string;
  isComment: boolean;
  isDisabled: boolean;
  isSheet: boolean;
  isHtml: boolean;
}
