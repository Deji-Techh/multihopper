import {
  Keypair,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import type { PreparedTxBundle } from "./types.js";

function isZeroSignature(signature: Uint8Array): boolean {
  return signature.every((byte) => byte === 0);
}

function sameSignature(left: Uint8Array, right: Uint8Array): boolean {
  return Buffer.from(left).equals(Buffer.from(right));
}

function signerIndex(tx: VersionedTransaction, keypair: Keypair): number {
  const index = tx.message.staticAccountKeys.findIndex((key) => key.equals(keypair.publicKey));
  if (index < 0 || index >= tx.signatures.length) {
    throw new Error(`Signer ${keypair.publicKey.toBase58()} is not required by this transaction.`);
  }
  return index;
}

export function signVersionedWithIntegrity(base64Tx: string, keypair: Keypair): string {
  const tx = VersionedTransaction.deserialize(Buffer.from(base64Tx, "base64"));
  const ourIndex = signerIndex(tx, keypair);
  const before = tx.signatures.map((signature) => Buffer.from(signature));

  tx.sign([keypair]);

  for (const [index, previous] of before.entries()) {
    if (index === ourIndex || isZeroSignature(previous)) continue;
    if (!sameSignature(previous, tx.signatures[index]!)) {
      throw new Error(`Partial signature at slot ${index} changed during signing.`);
    }
  }

  return Buffer.from(tx.serialize()).toString("base64");
}

export function signLegacy(base64Tx: string, keypair: Keypair): string {
  const tx = Transaction.from(Buffer.from(base64Tx, "base64"));
  tx.partialSign(keypair);
  return Buffer.from(tx.serialize({ requireAllSignatures: false, verifySignatures: false })).toString("base64");
}

export function signPreparedTxs(preparedTxs: PreparedTxBundle, keypair: Keypair): PreparedTxBundle {
  const signed: PreparedTxBundle = {};

  if (preparedTxs.keeperFundingTx) {
    signed.keeperFundingTx = signVersionedWithIntegrity(preparedTxs.keeperFundingTx, keypair);
  }

  if (preparedTxs.routeInitTxs?.length) {
    signed.routeInitTxs = preparedTxs.routeInitTxs.map((entry) => {
      const base64 = typeof entry === "string" ? entry : entry.base64;
      return { base64: signVersionedWithIntegrity(base64, keypair) };
    });
  }

  if (preparedTxs.orchestratorInitTx) {
    signed.orchestratorInitTx = signLegacy(preparedTxs.orchestratorInitTx, keypair);
  }

  if (preparedTxs.sessionInitTxs?.length) {
    signed.sessionInitTxs = preparedTxs.sessionInitTxs.map((base64) => signVersionedWithIntegrity(base64, keypair));
  }

  return signed;
}

export interface PartialSignatureFixtureResult {
  owner: string;
  serverSigner: string;
  serverSignaturePreserved: boolean;
  ownerSignatureAdded: boolean;
}

export function verifyDocumentedVersionedSignPreservesServerSignature(): PartialSignatureFixtureResult {
  const owner = Keypair.generate();
  const serverSigner = Keypair.generate();

  const instruction = new TransactionInstruction({
    programId: SystemProgram.programId,
    keys: [
      { pubkey: owner.publicKey, isSigner: true, isWritable: true },
      { pubkey: serverSigner.publicKey, isSigner: true, isWritable: false },
    ],
    data: Buffer.alloc(0),
  });

  const message = new TransactionMessage({
    payerKey: owner.publicKey,
    recentBlockhash: "11111111111111111111111111111111",
    instructions: [instruction],
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([serverSigner]);

  const ownerIndex = signerIndex(tx, owner);
  const serverIndex = signerIndex(tx, serverSigner);
  const serverSignatureBefore = Buffer.from(tx.signatures[serverIndex]!);
  const base64 = Buffer.from(tx.serialize()).toString("base64");
  const signedBase64 = signVersionedWithIntegrity(base64, owner);
  const signed = VersionedTransaction.deserialize(Buffer.from(signedBase64, "base64"));

  return {
    owner: owner.publicKey.toBase58(),
    serverSigner: serverSigner.publicKey.toBase58(),
    serverSignaturePreserved: sameSignature(serverSignatureBefore, signed.signatures[serverIndex]!),
    ownerSignatureAdded: !isZeroSignature(signed.signatures[ownerIndex]!),
  };
}
