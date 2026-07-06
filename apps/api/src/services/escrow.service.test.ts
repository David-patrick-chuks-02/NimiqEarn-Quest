import { describe, expect, it } from "vitest";
import { createEscrowService } from "./escrow.service.js";

describe("escrow service", () => {
  it("is disabled without an encryption key", () => {
    const escrow = createEscrowService({});
    expect(escrow.enabled).toBe(false);
    expect(() => escrow.createWallet()).toThrow();
  });

  it("provisions a wallet and round-trips the encrypted key", () => {
    const escrow = createEscrowService({ encryptionKey: "test-secret" });
    expect(escrow.enabled).toBe(true);

    const wallet = escrow.createWallet();
    expect(wallet.address).toMatch(/^NQ/);
    expect(wallet.keyCiphertext).toContain(".");
    // Two wallets are distinct.
    expect(escrow.createWallet().address).not.toBe(wallet.address);

    const key = escrow.decryptKey(wallet.keyCiphertext);
    expect(key).toHaveLength(64); // 32-byte private key as hex
  });

  it("computes the required funding in luna", () => {
    const escrow = createEscrowService({ encryptionKey: "k" });
    expect(escrow.requiredLuna(10, 5)).toBe(50 * 100_000);
    expect(escrow.requiredLuna(0.5, 3)).toBe(150_000);
  });

  it("reports not-reachable funding when no RPC is configured", async () => {
    const escrow = createEscrowService({ encryptionKey: "k" });
    const funding = await escrow.getFunding("NQ00 TEST", 100);
    expect(funding).toMatchObject({ reachable: false, funded: false, balanceLuna: null });
  });

  it("cannot decrypt a key from a different secret", () => {
    const a = createEscrowService({ encryptionKey: "secret-a" });
    const b = createEscrowService({ encryptionKey: "secret-b" });
    const wallet = a.createWallet();
    expect(() => b.decryptKey(wallet.keyCiphertext)).toThrow();
  });
});
