import { WalletProvider } from "../wallet-providers";

/** Context supplied to a policy before and after an action runs. */
export type ActionPolicyContext = {
  actionName: string;
  providerName: string;
  walletProvider: WalletProvider;
  args: unknown;
};

/** Result returned by a policy pre-flight check. */
export type ActionPolicyDecision = {
  allowed: boolean;
  reason?: string;
};

/** Optional, provider-agnostic guard around action execution. */
export interface ActionPolicy {
  beforeAction?: (
    context: ActionPolicyContext,
  ) => ActionPolicyDecision | Promise<ActionPolicyDecision>;
  afterAction?: (
    context: ActionPolicyContext,
    result: string,
  ) => void | Promise<void>;
  onActionError?: (
    context: ActionPolicyContext,
    error: unknown,
  ) => void | Promise<void>;
}

/** Error raised when an installed policy denies an action. */
export class ActionPolicyDeniedError extends Error {
  public readonly actionName: string;
  public readonly reason?: string;

  constructor(actionName: string, reason?: string) {
    super(reason ? `Action "${actionName}" denied: ${reason}` : `Action "${actionName}" denied by policy`);
    this.name = "ActionPolicyDeniedError";
    this.actionName = actionName;
    this.reason = reason;
  }
}
