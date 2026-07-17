export interface CreationRuntime {
  pending: boolean;
  completedNotice: boolean;
  activeRunId: string;
  providerStatus?: string;
}

export function createCreationRuntime(): CreationRuntime {
  return {
    pending: false,
    completedNotice: false,
    activeRunId: "",
  };
}

export function cloneCreationRuntime(runtime: Partial<CreationRuntime> = {}): CreationRuntime {
  return {
    ...createCreationRuntime(),
    ...runtime,
  };
}
