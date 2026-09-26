import { WalletProvider, CdpSmartWalletProvider } from "./wallet-providers";
import { Action, ActionPolicy, ActionProvider, walletActionProvider } from "./action-providers";

export type AgentKitOptions = {
  cdpApiKeyId?: string;
  cdpApiKeySecret?: string;
  cdpWalletSecret?: string;
  walletProvider?: WalletProvider;
  actionProviders?: ActionProvider[];
  actionPolicy?: ActionPolicy;
};

export class AgentKit {
  private walletProvider: WalletProvider;
  private actionProviders: ActionProvider[];
  private actionPolicy?: ActionPolicy;

  private constructor(config: AgentKitOptions & { walletProvider: WalletProvider }) {
    this.walletProvider = config.walletProvider;
    this.actionProviders = config.actionProviders || [walletActionProvider()];
    this.actionPolicy = config.actionPolicy;
  }

  public static async from(
    config: AgentKitOptions = { actionProviders: [walletActionProvider()] },
  ): Promise<AgentKit> {
    let walletProvider: WalletProvider | undefined = config.walletProvider;

    if (!config.walletProvider) {
      if (!config.cdpApiKeyId || !config.cdpApiKeySecret || !config.cdpWalletSecret) {
        throw new Error(
          "cdpApiKeyId, cdpApiKeySecret and cdpWalletSecret are required if not providing a walletProvider",
        );
      }

      walletProvider = await CdpSmartWalletProvider.configureWithWallet({
        apiKeyId: config.cdpApiKeyId,
        apiKeySecret: config.cdpApiKeySecret,
        walletSecret: config.cdpWalletSecret,
      });
    }

    return new AgentKit({ ...config, walletProvider: walletProvider! });
  }

  public getActions(): Action[] {
    const actions: Action[] = [];
    const unsupported: string[] = [];

    for (const actionProvider of this.actionProviders) {
      if (actionProvider.supportsNetwork(this.walletProvider.getNetwork())) {
        actions.push(...actionProvider.getActions(this.walletProvider, this.actionPolicy));
      } else {
        unsupported.push(actionProvider.name);
      }
    }

    if (unsupported.length > 0) {
      console.log(
        `Warning: The following action providers are not supported on the current network and will be unavailable: ${unsupported.join(", ")}`,
      );
      console.log("Current network:", this.walletProvider.getNetwork());
    }

    return actions;
  }
}
