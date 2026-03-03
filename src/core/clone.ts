import { BlockNode } from './ast';
import { getNodeLocation, getNodeOrigin, setNodeLocation, setNodeOrigin } from './location';

export interface CloneOptions {
  /**
   * Override origin for the entire cloned subtree.
   * Useful for blocks expanded from include(file) where line numbers belong to the included file.
   */
  origin?: string;
}

export function cloneBlock(block: BlockNode, options: CloneOptions = {}): BlockNode {
  return cloneValue(block, options) as BlockNode;
}

function cloneValue(value: unknown, options: CloneOptions): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : cloneValue(item, options)));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const inputObject = value as Record<string, unknown>;
  const outputObject: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(inputObject)) {
    if (child === undefined) {
      continue;
    }
    outputObject[key] = cloneValue(child, options);
  }

  const location = getNodeLocation(value);
  if (location) {
    setNodeLocation(outputObject, location);
  }

  const origin = options.origin ?? getNodeOrigin(value);
  if (origin) {
    setNodeOrigin(outputObject, origin);
  }

  return outputObject;
}
