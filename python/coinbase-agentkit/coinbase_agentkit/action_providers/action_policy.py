"""Optional policy hooks for AgentKit action execution."""
from dataclasses import dataclass
from typing import Any, Protocol

from ..wallet_providers import WalletProvider

@dataclass(frozen=True)
class ActionPolicyContext:
    """Context passed to policy hooks for one action invocation."""
    action_name: str
    provider_name: str
    wallet_provider: WalletProvider
    args: Any

class ActionPolicy(Protocol):
    """Provider-agnostic hooks for approval, budgets, auditing, or release."""
    def before_action(self, context: ActionPolicyContext) -> bool | str: ...
    def after_action(self, context: ActionPolicyContext, result: str) -> None: ...
    def on_action_error(self, context: ActionPolicyContext, error: BaseException) -> None: ...

class ActionPolicyDeniedError(RuntimeError):
    """Raised when a policy prevents an action from executing."""
    def __init__(self, action_name: str, reason: str | None = None) -> None:
        message = f"Action {action_name!r} denied"
        if reason:
            message += f": {reason}"
        super().__init__(message)
        self.action_name = action_name
        self.reason = reason
