# Next.js + Turnkey + Sui (Google Auth + Generic Move Calls)

This is a **Next.js 14+** application that demonstrates how to authenticate users via **Google OAuth** (using Turnkey's Embedded Wallet Kit) and execute **Sui Testnet** transactions using a server-side Turnkey wallet.

It goes beyond simple transfers by implementing a **Generic Move Call** engine, allowing the frontend to trigger *any* smart contract function while the backend handles the security, transaction building, and signing.

## Features

- **Authentication**: 
  - Login with Google (via Turnkey Auth Proxy).
  - Loading states to prevent UI flicker.
- **Backend Signing**: 
  - Securely sign transactions on the server using `@turnkey/sdk-server`.
  - Keys never leave the Turnkey secure enclave; the server only holds API keys.
- **Sui Integration**:
  - Dynamically derive Sui addresses from Turnkey Private Keys.
  - **Manual Signature Serialization**: Implements the Sui Ed25519 serialization standard manually (fixing recent SDK deprecations).
- **Functionality**:
  - **View Balance**: Real-time refreshing of SUI balance.
  - **Simple Transfer**: Send SUI to any address.
  - **Generic Move Calls**: Execute *any* Sui Move function (e.g., `pay::split_and_transfer`, NFT mints) by passing JSON configuration from the frontend.

---

## Prerequisites

1. **Node.js** (v18+) & **Yarn**.
2. **Turnkey Account**: [https://app.turnkey.com/](https://app.turnkey.com/)
3. **Google Cloud Console Project**: For OAuth credentials.
4. **Sui Testnet Tokens**: [Sui Faucet](https://discord.gg/sui) or [Sui Wallet Extension](https://chrome.google.com/webstore/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbnyfyjmg).

---

## Setup Guide

### 1. Google Cloud Console (OAuth)
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project.
3. Go to **APIs & Services > Credentials**.
4. Create **OAuth 2.0 Client ID** (Web Application).
5. Set **Authorized JavaScript Origins** to: `http://localhost:3000`
6. Set **Authorized Redirect URIs** to: `http://localhost:3000`
   > **Note:** Do NOT use `https` or trailing slashes (e.g. `http://localhost:3000/`) for localhost.
7. Copy your **Client ID**.

### 2. Turnkey Dashboard
1. **Organization ID**: Found in **Settings > General**.
2. **Auth Proxy**:
   - Go to **Settings > Auth Proxy**.
   - Enable it.
   - Add **Google** under "Social Logins".
   - Paste your **Google Client ID**.
   - Save and copy the **Auth Proxy Config ID**.
3. **API Keys** (For Backend):
   - Go to **Settings > API Keys**.
   - Create a new pair. **Save the Private Key immediately** (you won't see it again).
4. **Sui Wallet**:
   - Go to **Wallets**. Create a new wallet (Mnemonic).
   - Select **Curve: Ed25519** and **Address Format: Sui**.
   - Click into the wallet details and copy the **Private Key ID** (starts with `chk_...` or similar).

### 3. Environment Variables
Create a `.env.local` file in the root directory:

```bash
# --- Frontend (Public) ---
NEXT_PUBLIC_TURNKEY_ORGANIZATION_ID="<YOUR_ORG_ID>"
NEXT_PUBLIC_TURNKEY_AUTH_PROXY_CONFIG_ID="<YOUR_AUTH_PROXY_CONFIG_ID>"

# --- Backend (Private) ---
TURNKEY_API_PUBLIC_KEY="<YOUR_API_PUBLIC_KEY>"
TURNKEY_API_PRIVATE_KEY="<YOUR_API_PRIVATE_KEY>"
TURNKEY_SUI_PRIVATE_KEY_ID="<YOUR_SUI_PRIVATE_KEY_ID>"
```

### 4. Installation & Run

```bash
# Install dependencies
yarn install

# Run development server
yarn dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Usage

### 1. Funding the Wallet
Since this example uses a server-side key, you need to fund the **derived address**:
1. Run the app and log in with Google.
2. Copy the **Address** shown in the dashboard.
3. Go to the [Sui Discord Faucet](https://discord.gg/sui) (`#testnet-faucet` channel) and type:
   `!faucet <YOUR_ADDRESS>`
4. Click **Refresh** in the app to see your balance.

### 2. Generic Move Calls
The app includes a "Generic Move Call" card. This allows you to construct Programmable Transaction Blocks (PTBs) from JSON inputs.

**Default Example (Self-Transfer):**
The app defaults to calling `0x2::pay::split_and_transfer`. This splits 100 MIST from your gas coin and sends it back to you.

*   **Target**: `0x2::pay::split_and_transfer`
*   **Type Args**: `["0x2::sui::SUI"]`
*   **Args**:
    ```json
    [
      { "kind": "gas" },
      { "kind": "u64", "value": "100" },
      { "kind": "address", "value": "<YOUR_ADDRESS>" }
    ]
    ```

---

## Technical Implementation Details

### Server-Side Signing (`src/lib/server-turnkey.ts`)
The core logic resides here. We do not use the Turnkey Wallet on the frontend. Instead:
1.  **Dynamic Key Fetching**: The server queries Turnkey for the `privateKey` details (Public Key + Address) using the ID in `.env`.
2.  **PTB Construction**: We use `@mysten/sui` to build a transaction block based on the JSON args provided by the frontend.
3.  **Hashing**: We hash the transaction bytes using `blake2b` with the Sui Intent Message.
4.  **Signing**: We send the *hash* to Turnkey API (`signRawPayload`). Turnkey returns `r` and `s` values.
5.  **Serialization**: We manually construct the Sui Signature because `toSuiSignature` is deprecated in newer SDKs.
    *   Format: `Base64( Flag (0x00) + Signature (64b) + PublicKey (32b) )`

### Handling Generic Arguments
To support any Move call, we defined a custom `GenericMoveArg` type that maps JSON to Sui Transaction types:
- `kind: "gas"` → `tx.gas`
- `kind: "pure"` → `tx.pure(value)`
- `kind: "string"` → `tx.pure.string(value)`
- `kind: "u64"` → `tx.pure.u64(BigInt(value))`
- `kind: "object"` → `tx.object(id)`

---

## Troubleshooting

### `ERR_SSL_PROTOCOL_ERROR` or Login Loop
- **Cause:** Google redirected you to `https://localhost:3000` instead of `http`.
- **Fix:** Check your code in `src/app/providers.tsx`. The `oauthRedirectUri` must be `http://localhost:3000`. Also ensure Google Console matches this exactly.

### `loginWithOauth` does not exist
- **Cause:** You are using the legacy `@turnkey/sdk-browser`.
- **Fix:** This project uses the modern `@turnkey/react-wallet-kit`. Ensure you have run `yarn remove @turnkey/sdk-browser` if you migrated from an older tutorial.

### Error: `Dry run failed... VMVerificationOrDeserializationError`
- **Cause:** You are trying to call a contract that doesn't exist on the current network (e.g., calling `devnet_nft` while on Testnet).
- **Fix:** Use a contract that exists on Testnet (like `0x2::pay`) or switch the backend `suiClient` to use the Devnet URL.

### Error: `Invalid Pure type name`
- **Cause:** You passed a string to `tx.pure()` without specifying it is a string.
- **Fix:** Use `{ "kind": "string", "value": "..." }` in your arguments JSON.