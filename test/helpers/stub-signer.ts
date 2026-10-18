import type { FacilitatorEvmSigner } from "@x402/evm";
import {
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
  getAddress,
  recoverTypedDataAddress,
  zeroHash,
  type Address,
  type Hex,
  type Log,
} from "viem";

export interface StubAuthorization {
  from: Address;
  to: Address;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: Hex;
}

export interface StubSettlement {
  hash: Hex;
  authorization: StubAuthorization;
}

export interface StubSigner {
  signer: FacilitatorEvmSigner;
  address: Address;
  token: Address;
  writes: StubSettlement[];
  usedNonces: Set<string>;
  setBalance(address: Address, balance: bigint): void;
  failWritesWith(error: Error | undefined): void;
}

/**
 * Deterministic, in-memory implementation of the official FacilitatorEvmSigner.
 *
 * This is a TEST DOUBLE. It verifies EIP-712 signatures with viem and simulates
 * EIP-3009 state, but it does not broadcast anything. Tests and the local demo
 * using this signer must never be described as on-chain evidence.
 */
export function createStubSigner(options: {
  address: Address;
  token: Address;
  balance?: bigint;
}): StubSigner {
  const balances = new Map<string, bigint>();
  const usedNonces = new Set<string>();
  const writes: StubSettlement[] = [];
  const token = getAddress(options.token);
  let counter = 0;
  let writeError: Error | undefined;

  const defaultBalance = options.balance ?? 1_000_000_000n;

  function nonceKey(from: string, nonce: string): string {
    return `${from.toLowerCase()}:${nonce.toLowerCase()}`;
  }

  const signer: FacilitatorEvmSigner = {
    getAddresses: () => [options.address],
    getCode: async ({ address }) => {
      if (getAddress(address) === token) {
        return "0x60016000";
      }
      return "0x";
    },
    readContract: async ({ address, functionName, args }) => {
      const target = getAddress(address);
      const first = args?.[0];
      if (functionName === "transferWithAuthorization") {
        const [, , value, , validBefore, nonce] = args as [
          Address,
          Address,
          bigint,
          bigint,
          bigint,
          Hex,
        ];
        const balance = balances.get(String(first).toLowerCase()) ?? defaultBalance;
        if (usedNonces.has(nonceKey(String(first), nonce))) {
          throw new Error("AuthorizationAlreadyUsed");
        }
        if (value > balance) {
          throw new Error("ERC20InsufficientBalance");
        }
        if (validBefore < BigInt(Math.floor(Date.now() / 1_000))) {
          throw new Error("AuthorizationExpired");
        }
        return undefined;
      }
      if (functionName === "tryAggregate") {
        const calls = args?.[1];
        if (!Array.isArray(calls)) return [];
        const aggregated = calls.map((call: unknown) => {
          const entry = call as { target?: unknown; callData?: unknown };
          const callTarget = typeof entry.target === "string" ? entry.target.toLowerCase() : "";
          const callData = typeof entry.callData === "string" ? entry.callData : "";
          if (callTarget !== token.toLowerCase() || !callData.startsWith("0x")) {
            return { success: false, returnData: "0x" };
          }
          const selector = callData.slice(0, 10);
          if (selector === "0x70a08231") {
            const owner = `0x${callData.slice(34, 74)}`;
            return {
              success: true,
              returnData: encodeAbiParameters(
                [{ type: "uint256" }],
                [balances.get(owner.toLowerCase()) ?? defaultBalance],
              ),
            };
          }
          if (selector === "0x06fdde03") {
            return {
              success: true,
              returnData: encodeAbiParameters([{ type: "string" }], ["USDC"]),
            };
          }
          if (selector === "0x54fd4d50") {
            return {
              success: true,
              returnData: encodeAbiParameters([{ type: "string" }], ["2"]),
            };
          }
          if (selector === "0xe94a0102") {
            const owner = `0x${callData.slice(34, 74)}`;
            const nonce = `0x${callData.slice(74, 138)}`;
            return {
              success: true,
              returnData: encodeAbiParameters(
                [{ type: "bool" }],
                [usedNonces.has(nonceKey(owner, nonce))],
              ),
            };
          }
          return { success: false, returnData: "0x" };
        });
        return aggregated;
      }
      if (functionName === "balanceOf") {
        if (typeof first !== "string") return 0n;
        return balances.get(first.toLowerCase()) ?? defaultBalance;
      }
      if (functionName === "authorizationState") {
        if (typeof first !== "string" || typeof args?.[1] !== "string") return false;
        return usedNonces.has(nonceKey(first, args[1]));
      }
      if (functionName === "name") return "USDC";
      if (functionName === "version") return "2";
      if (functionName === "symbol") return "USDC";
      if (functionName === "decimals") return 6;
      if (functionName === "allowance") return 0n;
      if (target !== token) return undefined;
      return undefined;
    },
    verifyTypedData: async (args) => {
      try {
        const recovered = await recoverTypedDataAddress({
          domain: args.domain,
          types: args.types,
          primaryType: args.primaryType,
          message: args.message,
          signature: args.signature,
        } as unknown as Parameters<typeof recoverTypedDataAddress>[0]);
        return getAddress(recovered) === getAddress(args.address);
      } catch {
        return false;
      }
    },
    writeContract: async ({ functionName, args }) => {
      if (writeError) {
        throw writeError;
      }
      if (functionName !== "transferWithAuthorization") {
        throw new Error(`Unexpected stub writeContract call: ${functionName}`);
      }
      const [from, to, value, validAfter, validBefore, nonce] = args as [
        Address,
        Address,
        bigint,
        bigint,
        bigint,
        Hex,
      ];
      const authorization: StubAuthorization = {
        from: getAddress(from),
        to: getAddress(to),
        value: value.toString(),
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      };
      const hash = `0x${(++counter).toString(16).padStart(64, "0")}` as Hex;
      usedNonces.add(nonceKey(authorization.from, nonce));
      writes.push({ hash, authorization });
      return hash;
    },
    sendTransaction: async () => {
      throw new Error("Stub signer does not deploy smart wallets");
    },
    waitForTransactionReceipt: async ({ hash }) => {
      const settlement = writes.find((entry) => entry.hash === hash);
      if (!settlement) {
        throw new Error(`No stub settlement for ${hash}`);
      }
      const topics = encodeEventTopics({
        abi: erc20Abi,
        eventName: "Transfer",
        args: {
          from: settlement.authorization.from,
          to: settlement.authorization.to,
        },
      });
      const data = encodeAbiParameters(
        [{ type: "uint256" }],
        [BigInt(settlement.authorization.value)],
      );
      const log: Log = {
        address: token,
        topics: topics as unknown as Log["topics"],
        data,
        blockNumber: 1n,
        blockHash: zeroHash,
        transactionHash: hash,
        transactionIndex: 0,
        logIndex: writes.length - 1,
        removed: false,
      };
      return { status: "success", logs: [log] };
    },
  };

  return {
    signer,
    address: getAddress(options.address),
    token,
    writes,
    usedNonces,
    setBalance: (address, balance) => {
      balances.set(address.toLowerCase(), balance);
    },
    failWritesWith: (error) => {
      writeError = error;
    },
  };
}
