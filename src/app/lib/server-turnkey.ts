import { Turnkey } from "@turnkey/sdk-server";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { messageWithIntent, toSerializedSignature } from "@mysten/sui/cryptography";
import { bytesToHex } from "@noble/hashes/utils.js";
import { blake2b } from "@noble/hashes/blake2.js";

// 1. Initialize Turnkey Server Client
const turnkeyClient = new Turnkey({
    apiBaseUrl: "https://api.turnkey.com",
    apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
    apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.NEXT_PUBLIC_TURNKEY_ORGANIZATION_ID!,
});

// 2. Initialize Sui Client (Testnet)
const suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });

export async function getSuiWalletInfo() {
    const apiClient = turnkeyClient.apiClient();

    // DYNAMIC FETCH: We do not store SUI_ADDRESS in .env
    // We fetch the key details using the ID from .env
    const { privateKey } = await apiClient.getPrivateKey({
        organizationId: process.env.NEXT_PUBLIC_TURNKEY_ORGANIZATION_ID!,
        privateKeyId: process.env.TURNKEY_SUI_PRIVATE_KEY_ID!,
    });

    // Extract public key and address
    const publicKeyHex = privateKey.publicKey;
    const publicKey = new Ed25519PublicKey(Buffer.from(publicKeyHex, "hex"));
    const address = publicKey.toSuiAddress();

    // Fetch Balance from Sui Network
    const coins = await suiClient.getCoins({
        owner: address,
        coinType: "0x2::sui::SUI",
    });

    const totalBalance = coins.data.reduce(
        (sum, coin) => sum + BigInt(coin.balance),
        0n
    );

    return {
        address,
        publicKeyHex,
        balanceMist: totalBalance.toString(),
    };
}

export async function transferSui(to: string, amountSui: string) {
    // 1. Get Wallet Info (Address + Public Key)
    const { address, publicKeyHex } = await getSuiWalletInfo();
    const publicKey = new Ed25519PublicKey(Buffer.from(publicKeyHex, "hex"));

    // 2. Convert Amount to Mist (1 SUI = 10^9 MIST)
    const amountMist = BigInt(parseFloat(amountSui) * 1_000_000_000);

    // 3. Build Transaction
    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [amountMist]);
    tx.transferObjects([coin], to);
    tx.setSender(address);

    // 4. Fetch Gas logic + Build Bytes
    const txBytes = await tx.build({ client: suiClient });

    // 5. Hash the transaction (Blake2b256)
    const intentMessage = messageWithIntent("TransactionData", txBytes);
    const digest = blake2b(intentMessage, { dkLen: 32 });

    // 6. Sign with Turnkey
    const { r, s } = await turnkeyClient.apiClient().signRawPayload({
        signWith: address,
        payload: bytesToHex(digest),
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
    });

    // 7. Construct the Sui Serialized Signature manually
    // Format: Base64( [Flag] + [Signature] + [PublicKey] )

    // A. Combine R + S into the 64-byte signature
    const signatureBytes = new Uint8Array(Buffer.from(r + s, "hex"));

    // B. Get the Public Key bytes
    const pubKeyBytes = publicKey.toRawBytes();

    // C. Create a buffer for the full serialized signature
    // Length = 1 (flag) + 64 (sig) + 32 (pubkey)
    const serializedSigBytes = new Uint8Array(1 + signatureBytes.length + pubKeyBytes.length);

    // D. Set the Flag (0x00 for Ed25519)
    serializedSigBytes.set([0x00]);

    // E. Set the Signature
    serializedSigBytes.set(signatureBytes, 1);

    // F. Set the Public Key
    serializedSigBytes.set(pubKeyBytes, 1 + signatureBytes.length);

    // G. Convert to Base64
    const serializedSignature = Buffer.from(serializedSigBytes).toString("base64");

    // 8. Execute on Chain
    const result = await suiClient.executeTransactionBlock({
        transactionBlock: txBytes,
        signature: serializedSignature,
        requestType: "WaitForEffectsCert",
        options: { showEffects: true },
    });

    return result;
}

// Define a type for incoming arguments so we know how to encode them for Sui
export type GenericMoveArg =
    | { kind: "object"; value: string }
    | { kind: "u64"; value: string }
    | { kind: "string"; value: string }
    | { kind: "address"; value: string }
    | { kind: "bool"; value: boolean }
    | { kind: "gas"; value?: string };

export async function executeGenericMoveCall(
    target: string,
    typeArguments: string[],
    args: GenericMoveArg[]
) {
    // 1. Get Wallet Info
    const { address, publicKeyHex } = await getSuiWalletInfo();
    const publicKey = new Ed25519PublicKey(Buffer.from(publicKeyHex, "hex"));

    // 2. Build Transaction
    const tx = new Transaction();
    tx.setSender(address);

    // Convert our JSON args into Sui Transaction Arguments
    const txArgs = args.map((arg) => {
        switch (arg.kind) {
            case "gas":
                // <--- NEW: Pass the Gas Coin itself
                return tx.gas;
            case "object":
                return tx.object(arg.value!); // non-null assertion if value provided
            case "u64":
                return tx.pure.u64(BigInt(arg.value!));
            case "string":
                return tx.pure.string(arg.value!);
            case "address":
                return tx.pure.address(arg.value!);
            case "bool":
                return tx.pure.bool(arg.value!);
            default:
                throw new Error(`Unsupported argument kind: ${(arg as any).kind}`);
        }
    });

    // Add the Move Call to the transaction
    tx.moveCall({
        target: target,         // e.g. "0x2::devnet_nft::mint"
        typeArguments: typeArguments, // e.g. []
        arguments: txArgs,
    });

    // 3. Build & Hash
    const txBytes = await tx.build({ client: suiClient });
    const intentMessage = messageWithIntent("TransactionData", txBytes);
    const digest = blake2b(intentMessage, { dkLen: 32 });

    // 4. Sign with Turnkey
    const { r, s } = await turnkeyClient.apiClient().signRawPayload({
        signWith: address,
        payload: bytesToHex(digest),
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
    });

    // 5. Serialize Signature (Using the helper from previous steps)
    const signatureBytes = new Uint8Array(Buffer.from(r + s, "hex"));
    const serializedSignature = toSerializedSignature({
        signatureScheme: "ED25519",
        signature: signatureBytes,
        publicKey: publicKey,
    });

    // 6. Broadcast
    const result = await suiClient.executeTransactionBlock({
        transactionBlock: txBytes,
        signature: serializedSignature,
        requestType: "WaitForEffectsCert",
        options: { showEffects: true },
    });

    return result;
}