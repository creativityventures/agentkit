"""Base class for action providers."""
from abc import ABC, abstractmethod
from collections.abc import Callable
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

from ..network import Network
from ..wallet_providers import WalletProvider
from .action_policy import ActionPolicy, ActionPolicyContext, ActionPolicyDeniedError

TWalletProvider = TypeVar("TWalletProvider", bound=WalletProvider)

class Action(BaseModel):
    """Represents an action that can be performed by an agent."""
    name: str
    description: str
    args_schema: type[BaseModel] | None = None
    invoke: Callable = Field(..., exclude=True)
    model_config = ConfigDict(arbitrary_types_allowed=True)

class ActionProvider(Generic[TWalletProvider], ABC):
    """Base class for all action providers."""
    def __init__(self, name: str, action_providers: list["ActionProvider[TWalletProvider]"]) -> None:
        self.name = name
        self.action_providers = action_providers
        for method_name in dir(self):
            method = getattr(self, method_name)
            if hasattr(method, "_add_to_actions"):
                method._add_to_actions(self)

    def get_actions(self, wallet_provider: TWalletProvider, action_policy: ActionPolicy | None = None) -> list[Action]:
        """Get actions and optionally wrap each invocation with policy hooks."""
        actions: list[Action] = []
        action_providers = [self, *self.action_providers]

        for provider in action_providers:
            provider_actions = getattr(provider, "_actions", [])
            for action_metadata in provider_actions:
                def invoke(args, m=action_metadata, p=provider):
                    context = ActionPolicyContext(m.name, p.name, wallet_provider, args)
                    before = getattr(action_policy, "before_action", None) if action_policy else None
                    if before:
                        decision = before(context)
                        if decision is False or isinstance(decision, str):
                            reason = decision if isinstance(decision, str) else None
                            raise ActionPolicyDeniedError(m.name, reason)
                    try:
                        result = (m.invoke(p, wallet_provider, args) if m.wallet_provider else m.invoke(p, args))
                        after = getattr(action_policy, "after_action", None) if action_policy else None
                        if after:
                            after(context, result)
                        return result
                    except BaseException as error:
                        on_error = getattr(action_policy, "on_action_error", None) if action_policy else None
                        if on_error:
                            on_error(context, error)
                        raise

                actions.append(Action(name=action_metadata.name, description=action_metadata.description, args_schema=action_metadata.args_schema, invoke=invoke))
        return actions

    @abstractmethod
    def supports_network(self, network: Network) -> bool:
        """Check if this provider supports the given network."""
        pass
