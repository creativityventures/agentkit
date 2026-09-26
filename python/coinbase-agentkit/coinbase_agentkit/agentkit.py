"""AgentKit - The framework for enabling AI agents to take actions onchain."""

from pydantic import BaseModel, ConfigDict

from .action_providers import Action, ActionPolicy, ActionProvider, wallet_action_provider
from .wallet_providers import (
    CdpEvmWalletProvider,
    CdpEvmWalletProviderConfig,
    WalletProvider,
)

class AgentKitConfig(BaseModel):
    """Configuration options for AgentKit."""
    cdp_api_key_id: str | None = None
    cdp_api_key_secret: str | None = None
    cdp_wallet_secret: str | None = None
    wallet_provider: WalletProvider | None = None
    action_providers: list[ActionProvider] | None = None
    action_policy: ActionPolicy | None = None
    model_config = ConfigDict(arbitrary_types_allowed=True)

class AgentKit:
    """Main AgentKit class for managing wallet and action providers."""
    def __init__(self, config: AgentKitConfig | None = None):
        if not config:
            config = AgentKitConfig()
        self.wallet_provider = config.wallet_provider or CdpEvmWalletProvider(
            CdpEvmWalletProviderConfig(
                api_key_id=config.cdp_api_key_id,
                api_key_secret=config.cdp_api_key_secret,
                wallet_secret=config.cdp_wallet_secret,
            )
        )
        self.action_providers = config.action_providers or [wallet_action_provider()]
        self.action_policy = config.action_policy

    def get_actions(self) -> list[Action]:
        """Get available actions, optionally guarded by the configured policy."""
        if not self.wallet_provider:
            raise ValueError("No wallet provider configured")
        actions: list[Action] = []
        for provider in self.action_providers:
            if provider.supports_network(self.wallet_provider.get_network()):
                actions.extend(provider.get_actions(self.wallet_provider, self.action_policy))
        return actions
