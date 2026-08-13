import type { ExecEvent } from "../sprout/types";
import type { GardenState, GrowthNode, Root } from "./types";

export function createInitialState(): GardenState {
  return {
    tree: null,
    nodeMap: new Map(),
    activePath: [],
    error: null,
  };
}

export function gardenReducer(
  state: GardenState,
  event: ExecEvent,
): GardenState {
  // For performance at 60fps, we mutate the nodes directly
  // and return a new state wrapper to trigger React updates.
  const newState = { ...state };

  switch (event.type) {
    case "program_start": {
      const rootNode: GrowthNode = {
        id: "root",
        type: "stem",
        children: [],
        leaves: [],
        seedpods: [],
        roots: [],
        blueprints: [],
        fruits: [],
        depth: 0,
        health: 1,
        diseaseLevel: 0,
        isComplete: false,
      };
      newState.tree = rootNode;
      newState.nodeMap.set("root", rootNode);
      newState.activePath = ["root"];
      break;
    }
    case "call_enter": {
      const parentNode = newState.nodeMap.get(event.parentId);
      if (!parentNode) break;

      const newNode: GrowthNode = {
        id: event.nodeId,
        type: "branch",
        fnName: event.fnName,
        parentId: event.parentId,
        children: [],
        leaves: [],
        seedpods: [],
        roots: [],
        blueprints: [],
        fruits: [],
        depth: event.depth,
        health: 1,
        diseaseLevel: 0,
        isComplete: false,
        sourceLine: event.sourceLine,
      };
      parentNode.children.push(newNode);
      newState.nodeMap.set(event.nodeId, newNode);
      newState.activePath.push(event.nodeId);
      break;
    }
    case "call_exit": {
      const node = newState.nodeMap.get(event.nodeId);
      if (node) {
        node.isComplete = true;
      }
      newState.activePath = newState.activePath.filter(
        (id) => id !== event.nodeId,
      );
      break;
    }
    case "loop_enter": {
      const parentNode = newState.nodeMap.get(event.parentId);
      if (!parentNode) break;

      const newNode: GrowthNode = {
        id: event.nodeId,
        type: "whorl",
        parentId: event.parentId,
        children: [],
        leaves: [],
        seedpods: [],
        roots: [],
        blueprints: [],
        fruits: [],
        depth: parentNode.depth,
        health: 1,
        diseaseLevel: 0,
        isComplete: false,
        sourceLine: event.sourceLine,
      };
      parentNode.children.push(newNode);
      newState.nodeMap.set(event.nodeId, newNode);
      newState.activePath.push(event.nodeId);
      break;
    }
    case "loop_exit": {
      const node = newState.nodeMap.get(event.nodeId);
      if (node) {
        node.isComplete = true;
      }
      newState.activePath = newState.activePath.filter(
        (id) => id !== event.nodeId,
      );
      break;
    }
    case "var_declare":
    case "var_assign": {
      const activeNodeId = newState.activePath[newState.activePath.length - 1];
      const activeNode = newState.nodeMap.get(activeNodeId);
      if (activeNode) {
        const existingLeaf = activeNode.leaves.find(
          (l) => l.name === event.name,
        );
        const value =
          event.type === "var_assign" ? event.newValue : (event as any).value;
        if (existingLeaf) {
          existingLeaf.value = value;
        } else {
          activeNode.leaves.push({ id: event.name, name: event.name, value });
        }
      }
      break;
    }
    case "scope_exit": {
      // In a real implementation, we'd find the node associated with this scope
      // and remove the dropped leaves. For now, we drop from the current active node.
      const activeNodeId = newState.activePath[newState.activePath.length - 1];
      const activeNode = newState.nodeMap.get(activeNodeId);
      if (activeNode) {
        activeNode.leaves = activeNode.leaves.filter(
          (l) => !event.droppedVars.includes(l.name),
        );
      }
      break;
    }
    case "alloc": {
      // Roots grow from wherever the allocation actually happened, not
      // always from the root stem - otherwise every function's memory
      // visually piles up in one place and you can't tell which call
      // is responsible for a given leak just by looking at the plant.
      const owner =
        newState.nodeMap.get(event.nodeId) ?? newState.nodeMap.get("root");
      if (owner) {
        owner.roots.push({
          id: event.ptrId,
          size: event.size,
          health: 1,
          sourceLine: event.sourceLine,
          ownerNodeId: owner.id,
        });
      }
      break;
    }
    case "free": {
      for (const node of newState.nodeMap.values()) {
        const before = node.roots.length;
        node.roots = node.roots.filter((r) => r.id !== event.ptrId);
        if (node.roots.length !== before) break;
      }
      break;
    }
    case "leak_detected": {
      let rootItem: Root | undefined;
      for (const node of newState.nodeMap.values()) {
        rootItem = node.roots.find((r) => r.id === event.ptrId);
        if (rootItem) break;
      }
      if (rootItem) {
        // A leak should read as sick immediately on detection, then get
        // steadily worse the longer it goes unaddressed - not the reverse.
        // Drop to 0.5 the instant it's flagged, then decay toward 0 as
        // ageInTicks grows, so a demo that leaves a leak running visibly
        // worsens over time.
        const decay = Math.min(0.5, event.ageInTicks / 100);
        rootItem.health = Math.max(0, 0.5 - decay);

        // Spread discoloration up into the branch that made the
        // allocation, and fainter still into its ancestors - this is the
        // pitch's actual promise ("an unreleased allocation shows as a
        // visible growth spreading through the plant"), not just a sick
        // root sitting in isolation at the bottom of the tree. Severity
        // (1 - health) drives how strong the spread is; distance from the
        // leak halves the effect at each step up, so it fades toward the
        // trunk rather than painting the whole plant uniformly.
        const severity = 1 - rootItem.health;
        let ownerId = rootItem.ownerNodeId;
        let falloff = 1;
        const visited = new Set<string>();
        while (ownerId && !visited.has(ownerId)) {
          visited.add(ownerId);
          const owner = newState.nodeMap.get(ownerId);
          if (!owner) break;
          owner.diseaseLevel = Math.max(owner.diseaseLevel, severity * falloff);
          ownerId = owner.parentId;
          falloff *= 0.55;
          if (falloff < 0.05) break;
        }
      }
      break;
    }
    case "depth_warning": {
      const activeNodeId = newState.activePath[newState.activePath.length - 1];
      if (activeNodeId) {
        const activeNode = newState.nodeMap.get(activeNodeId);
        if (activeNode) {
          activeNode.health = Math.max(
            0.1,
            1 - (event.depth - event.threshold) / 20,
          );
        }
      }
      break;
    }
    case "no_progress_warning": {
      const node = newState.nodeMap.get(event.nodeId);
      if (node) {
        node.health = Math.max(
          0.1,
          1 - event.iterationsWithoutStateChange / 100,
        );
      }
      break;
    }
    case "error": {
      newState.error = {
        kind: event.kind,
        message: event.message,
        nodeId: event.nodeId,
      };
      const node = newState.nodeMap.get(event.nodeId);
      if (node) {
        node.health = 0; // Mark node as dead
      }
      break;
    }
    case "program_end": {
      if (newState.tree) {
        newState.tree.isComplete = true;
      }
      newState.activePath = [];
      break;
    }
    case "array_declare": {
      const activeNodeId = newState.activePath[newState.activePath.length - 1];
      const activeNode = newState.nodeMap.get(activeNodeId);
      if (activeNode) {
        activeNode.seedpods.push({
          id: (event as any).name,
          name: (event as any).name,
          elements: (event as any).elements,
        });
      }
      break;
    }
    case "array_oob": {
      const activeNodeId = newState.activePath[newState.activePath.length - 1];
      const activeNode = newState.nodeMap.get(activeNodeId);
      if (activeNode && activeNode.seedpods.length > 0) {
        activeNode.seedpods[activeNode.seedpods.length - 1].caterpillarDamage =
          1;
      }
      break;
    }
    case "try_enter": {
      const activeNodeId = newState.activePath[newState.activePath.length - 1];
      const activeNode = newState.nodeMap.get(activeNodeId);
      if (activeNode) {
        activeNode.hasProtectiveSap = true;
      }
      break;
    }
    case "error_caught": {
      const activeNodeId = newState.activePath[newState.activePath.length - 1];
      const activeNode = newState.nodeMap.get(activeNodeId);
      if (activeNode) {
        activeNode.sealedSnap = true;
      }
      break;
    }
    case "class_declare": {
      const activeNodeId = newState.activePath[newState.activePath.length - 1];
      const activeNode = newState.nodeMap.get(activeNodeId);
      if (activeNode) {
        activeNode.blueprints.push({
          id: (event as any).className,
          name: (event as any).className,
        });
      }
      break;
    }
    case "object_instantiate": {
      const activeNodeId = newState.activePath[newState.activePath.length - 1];
      const activeNode = newState.nodeMap.get(activeNodeId);
      if (activeNode) {
        activeNode.fruits.push({
          id: (event as any).objId,
          className: (event as any).className,
          props: {},
        });
      }
      break;
    }
    case "prop_assign": {
      for (const node of newState.nodeMap.values()) {
        const fruit = node.fruits.find((f) => f.id === (event as any).objId);
        if (fruit) {
          fruit.props[(event as any).propName] = (event as any).value;
          break;
        }
      }
      break;
    }
    case "global_abuse": {
      const node = newState.nodeMap.get(event.nodeId);
      if (node) {
        node.kudzuLevel = Math.min(
          1,
          (node.kudzuLevel || 0) + (event as any).depth / 15,
        );
        let currentId = node.parentId;
        let falloff = 0.8;
        while (currentId) {
          const parent = newState.nodeMap.get(currentId);
          if (!parent) break;
          parent.kudzuLevel = Math.min(
            1,
            (parent.kudzuLevel || 0) + ((event as any).depth / 15) * falloff,
          );
          falloff *= 0.7;
          currentId = parent.parentId;
        }
      }
      break;
    }
  }

  return newState;
}
