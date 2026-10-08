export interface PreparedTxBundle {
  keeperFundingTx?: string | null;
  routeInitTxs?: Array<{ base64: string } | string> | null;
  orchestratorInitTx?: string | null;
  sessionInitTxs?: string[] | null;
  recentBlockhash?: string;
  lastValidBlockHeight?: number;
  resume?: {
    routeAlreadyDeployed?: boolean;
    existingHopCount?: number;
    totalHops?: number;
    orchestratorAlreadyInitialized?: boolean;
    completedStepIndices?: number[];
    totalSteps?: number;
    keeperAlreadyFunded?: boolean;
    nothingToDo?: boolean;
  };
}

export interface BroadcastSignatures {
  keeperFundingSignature?: string;
  routeInitSignatures?: string[];
  orchestratorInitSignature?: string;
  sessionInitSignatures?: string[];
}
