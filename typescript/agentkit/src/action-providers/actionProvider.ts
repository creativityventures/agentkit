import { z } from "zod";
import { WalletProvider } from "../wallet-providers";
import { Network } from "../network";
import { StoredActionMetadata, ACTION_DECORATOR_KEY } from "./actionDecorator";
import { ActionPolicy, ActionPolicyDeniedError } from "./actionPolicy";

export interface Action<TActionSchema extends z.ZodSchema = z.ZodSchema> {
  name: string;
  description: string;
  schema: TActionSchema;
  invoke: (args: z.infer<TActionSchema>) => Promise<string>;
}

export abstract class ActionProvider<TWalletProvider extends WalletProvider = WalletProvider> {
  public readonly name: string;
  public readonly actionProviders: ActionProvider<TWalletProvider>[];

  constructor(name: string, actionProviders: ActionProvider<TWalletProvider>[]) {
    this.name = name;
    this.actionProviders = actionProviders;
  }

  getActions(walletProvider: TWalletProvider, actionPolicy?: ActionPolicy): Action[] {
    const actions: Action[] = [];
    const actionProviders = [this, ...this.actionProviders];

    for (const actionProvider of actionProviders) {
      const actionsMetadataMap: StoredActionMetadata | undefined = Reflect.getMetadata(
        ACTION_DECORATOR_KEY,
        actionProvider.constructor,
      );

      if (!actionsMetadataMap) {
        if (!(actionProvider instanceof ActionProvider)) {
          console.warn("Warning: action provider is not an instance of ActionProvider.");
        } else {
          console.warn("Warning: action provider has no actions.");
        }
        continue;
      }

      for (const actionMetadata of actionsMetadataMap.values()) {
        actions.push({
          name: actionMetadata.name,
          description: actionMetadata.description,
          schema: actionMetadata.schema,
          invoke: async schemaArgs => {
            const context = {
              actionName: actionMetadata.name,
              providerName: actionProvider.name,
              walletProvider,
              args: schemaArgs,
            };

            if (actionPolicy?.beforeAction) {
              const decision = await actionPolicy.beforeAction(context);
              if (!decision.allowed) {
                throw new ActionPolicyDeniedError(actionMetadata.name, decision.reason);
              }
            }

            const args: unknown[] = [];
            if (actionMetadata.walletProvider) {
              args[0] = walletProvider;
            }
            args.push(schemaArgs);

            try {
              const result = await actionMetadata.invoke.apply(actionProvider, args);
              await actionPolicy?.afterAction?.(context, result);
              return result;
            } catch (error) {
              await actionPolicy?.onActionError?.(context, error);
              throw error;
            }
          },
        });
      }
    }

    return actions;
  }

  abstract supportsNetwork(network: Network): boolean;
}
