import { BlockAttributes } from '../ast';

export interface PendingBlockContext {
  attrs?: BlockAttributes;
  foldNext: boolean;
  tagName?: string;
  isComment: boolean;
  isDisabled: boolean;
  isSheet: boolean;
  isHtml: boolean;
}
