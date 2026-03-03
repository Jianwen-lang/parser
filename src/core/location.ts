export interface SourceLocation {
  line: number;
  column: number;
}

const NODE_LOCATION = Symbol('jianwen.node.location');
const NODE_ORIGIN = Symbol('jianwen.node.origin');

export type NodeOrigin = string;

export function setNodeLocation(node: object, location: SourceLocation): void {
  Object.defineProperty(node, NODE_LOCATION, {
    value: location,
    enumerable: false,
    configurable: false,
    writable: false,
  });
}

export function getNodeLocation(node: object): SourceLocation | undefined {
  return (node as { [NODE_LOCATION]?: SourceLocation })[NODE_LOCATION];
}

export function setNodeOrigin(node: object, origin: NodeOrigin): void {
  Object.defineProperty(node, NODE_ORIGIN, {
    value: origin,
    enumerable: false,
    configurable: false,
    writable: false,
  });
}

export function getNodeOrigin(node: object): NodeOrigin | undefined {
  return (node as { [NODE_ORIGIN]?: NodeOrigin })[NODE_ORIGIN];
}
