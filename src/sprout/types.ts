export interface SproutObject {
  id: string;
  className: string;
  props: Record<string, any>; // 'any' prevents TS circular reference issues here
}

export type Value = number | string | boolean | null | Value[] | SproutObject;

export type ExecEvent =
  | { type: 'program_start'; tick: number }
  | { type: 'call_enter'; nodeId: string; parentId: string; fnName: string; args: Value[]; depth: number; sourceLine: number; tick: number }
  | { type: 'call_exit'; nodeId: string; returnValue: Value; sourceLine: number; tick: number }
  | { type: 'loop_enter'; nodeId: string; parentId: string; sourceLine: number; tick: number }
  | { type: 'loop_iter'; nodeId: string; iteration: number; tick: number }
  | { type: 'loop_exit'; nodeId: string; totalIterations: number; tick: number }
  | { type: 'var_declare'; nodeId: string; scopeId: string; name: string; value: Value; sourceLine: number; tick: number }
  | { type: 'var_assign'; nodeId: string; name: string; oldValue: Value; newValue: Value; sourceLine: number; tick: number }
  | { type: 'scope_exit'; scopeId: string; droppedVars: string[]; tick: number }
  | { type: 'alloc'; nodeId: string; ptrId: string; size: number; sourceLine: number; tick: number }
  | { type: 'free'; ptrId: string; sourceLine: number; tick: number }
  | { type: 'leak_detected'; ptrId: string; allocLine: number; ageInTicks: number; tick: number }
  | { type: 'depth_warning'; depth: number; threshold: number; tick: number }
  | { type: 'no_progress_warning'; nodeId: string; iterationsWithoutStateChange: number; tick: number }
  | { type: 'error'; kind: string; message: string; nodeId: string; sourceLine: number; tick: number }
  | { type: 'program_end'; status: 'ok' | 'error' | 'halted'; tick: number }
  | { type: 'array_declare'; nodeId: string; scopeId: string; name: string; elements: Value[]; sourceLine: number; tick: number }
  | { type: 'array_access'; nodeId: string; name: string; index: number; value: Value; sourceLine: number; tick: number }
  | { type: 'array_oob'; nodeId: string; name: string; index: number; length: number; sourceLine: number; tick: number }
  | { type: 'try_enter'; nodeId: string; sourceLine: number; tick: number }
  | { type: 'except_enter'; nodeId: string; sourceLine: number; tick: number }
  | { type: 'error_caught'; nodeId: string; kind: string; message: string; sourceLine: number; tick: number }
  | { type: 'class_declare'; nodeId: string; className: string; sourceLine: number; tick: number }
  | { type: 'object_instantiate'; nodeId: string; className: string; objId: string; sourceLine: number; tick: number }
  | { type: 'prop_assign'; nodeId: string; objId: string; propName: string; value: Value; sourceLine: number; tick: number }
  | { type: 'global_abuse'; nodeId: string; varName: string; depth: number; sourceLine: number; tick: number };
