export interface Leaf {
  id: string;
  name: string;
  value: any;
}

export interface Seedpod {
  id: string;
  name: string;
  elements: any[];
  caterpillarDamage?: number; // 0 (healthy) to 1 (destroyed)
}

export interface Blueprint {
  id: string;
  name: string;
}

export interface Fruit {
  id: string;
  className: string;
  props: Record<string, any>;
}

export interface Root {
  id: string; // ptrId
  size: number;
  health: number; // 0 (leaked) to 1 (healthy)
  sourceLine?: number;
  // The node that allocated this pointer - lets a leak push discoloration
  // up into the specific branch responsible, not just the root itself.
  ownerNodeId?: string;
}

export interface GrowthNode {
  id: string;
  type: "stem" | "branch" | "whorl";
  fnName?: string;
  parentId?: string; // lets disease propagate upward toward the trunk
  children: GrowthNode[];
  leaves: Leaf[];
  seedpods: Seedpod[];
  roots: Root[];
  blueprints: Blueprint[];
  fruits: Fruit[];
  depth: number;
  health: number; // 0 to 1 - 0 means dead/crashed, stops rendering entirely
  // Separate from health: how much leak-discoloration has crept up into
  // this stem from roots it owns, 0 (clean) to 1 (fully diseased). Kept
  // distinct from health so a leaking branch stays visible and climbable
  // (just visibly sick) rather than disappearing like a crashed one.
  diseaseLevel: number;
  isComplete: boolean;
  hasProtectiveSap?: boolean; // From 'try' block
  sealedSnap?: boolean; // From recovered error inside 'try'
  kudzuLevel?: number; // Global variable abuse visualization
  sourceLine?: number;
}

export interface GardenState {
  tree: GrowthNode | null;
  nodeMap: Map<string, GrowthNode>;
  activePath: string[]; // stack of node IDs
  error: { kind: string; message: string; nodeId: string } | null;
}
