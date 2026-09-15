import "reflect-metadata";
import { z } from "zod";
import { Network } from "../network";
import { WalletProvider } from "../wallet-providers";
import { ActionProvider } from "./actionProvider";
import { ACTION_DECORATOR_KEY, ActionMetadata } from "./actionDecorator";
import { ActionPolicyDeniedError } from "./actionPolicy";

const schema = z.object({ value: z.number() });

class TestProvider extends ActionProvider {
  constructor() {
    super("test", []);
  }

  supportsNetwork(_network: Network): boolean {
    return true;
  }
}

const wallet = {
  getNetwork: jest.fn().mockReturnValue({
    protocolFamily: "evm",
    networkId: "base-sepolia",
  }),
} as unknown as WalletProvider;

describe("ActionPolicy", () => {
  let invoke: jest.Mock;
  let provider: TestProvider;

  beforeEach(() => {
    invoke = jest.fn().mockResolvedValue("ok");
    provider = new TestProvider();
    const metadata: ActionMetadata = {
      name: "test_run",
      description: "Run a test action",
      schema,
      invoke,
      walletProvider: false,
    };
    Reflect.defineMetadata(
      ACTION_DECORATOR_KEY,
      new Map([["run", metadata]]),
      TestProvider,
    );
  });

  it("denies an action before invocation", async () => {
    const beforeAction = jest.fn().mockResolvedValue({
      allowed: false,
      reason: "budget exceeded",
    });
    const action = provider.getActions(wallet, { beforeAction })[0];

    await expect(action.invoke({ value: 1 })).rejects.toMatchObject({
      name: "ActionPolicyDeniedError",
      actionName: "test_run",
      reason: "budget exceeded",
    });
    expect(invoke).not.toHaveBeenCalled();
    expect(beforeAction).toHaveBeenCalledWith(expect.objectContaining({
      actionName: "test_run",
      providerName: "test",
      args: { value: 1 },
    }));
  });

  it("runs success and error hooks", async () => {
    const afterAction = jest.fn();
    const onActionError = jest.fn();
    const action = provider.getActions(wallet, { afterAction, onActionError })[0];

    await expect(action.invoke({ value: 1 })).resolves.toBe("ok");
    expect(afterAction).toHaveBeenCalledWith(expect.objectContaining({ actionName: "test_run" }), "ok");
    expect(onActionError).not.toHaveBeenCalled();

    const error = new Error("failed");
    invoke.mockRejectedValueOnce(error);
    await expect(action.invoke({ value: 2 })).rejects.toBe(error);
    expect(onActionError).toHaveBeenCalledWith(expect.objectContaining({ args: { value: 2 } }), error);
  });

  it("keeps the default path when no policy is provided", async () => {
    const action = provider.getActions(wallet)[0];
    await expect(action.invoke({ value: 1 })).resolves.toBe("ok");
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
