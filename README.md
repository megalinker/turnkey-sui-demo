# Next.js + Turnkey + Sui (Google Auth Demo)

This is a **Next.js 14+** application that demonstrates how to authenticate users via **Google OAuth** (using Turnkey's Embedded Wallet Kit) and execute **Sui Testnet** transactions using a server-side Turnkey wallet.

## Features

- **Authentication**: Login with Google (via Turnkey Auth Proxy).
- **Backend Signing**: Securely sign transactions on the server using `@turnkey/sdk-server`.
- **Sui Integration**:
  - Dynamically derive Sui addresses from Turnkey Private Keys.
  - Manually construct Sui-compliant Ed25519 signatures.
  - Execute transactions on the Sui Testnet.
- **UI**:
  - Loading states (prevents login flicker).
  - Real-time balance refreshing.
  - Transaction status reporting.

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

## How It Works

### Frontend (`src/app/page.tsx`)
1. Uses `@turnkey/react-wallet-kit` to handle the OAuth flow.
2. Checks `clientState` to show a loading spinner while initializing.
3. Once authenticated (`user` is present), it fetches the wallet data from your backend.

### Backend (`src/lib/server-turnkey.ts`)
1. Initializes `@turnkey/sdk-server` with your API keys.
2. **`getSuiWalletInfo`**: Dynamically fetches the private key info from Turnkey to derive the public key and Sui address. It *never* exposes the private key itself.
3. **`transferSui`**:
   - Builds a Sui transaction.
   - Hashes the transaction bytes.
   - Sends the hash to Turnkey to be signed (`signRawPayload`).
   - **Crucial Step**: Manually constructs the Sui Serialized Signature (Flag `0x00` + Signature + Public Key) because `Ed25519PublicKey.toSuiSignature()` is deprecated in newer Sui SDKs.

---

## Troubleshooting

### `ERR_SSL_PROTOCOL_ERROR` or Login Loop
- **Cause:** Google redirected you to `https://localhost:3000` instead of `http`.
- **Fix:** Check your code in `src/app/providers.tsx`. The `oauthRedirectUri` must be `http://localhost:3000`. Also ensure Google Console matches this exactly.

### `loginWithOauth` does not exist
- **Cause:** You are using the legacy `@turnkey/sdk-browser`.
- **Fix:** This project uses the modern `@turnkey/react-wallet-kit`. Ensure you have run `yarn remove @turnkey/sdk-browser` if you migrated from an older tutorial.

### Property `toSuiSignature` does not exist
- **Cause:** Newer versions of `@mysten/sui` removed this helper method.
- **Fix:** We implemented a manual `toSerializedSignature` helper in `src/lib/server-turnkey.ts` to concatenate the flag, signature, and public key bytes manually.

---

## Funding the Wallet
Since this example uses a server-side key, you need to fund the **derived address**:
1. Run the app and log in.
2. Copy the **Address** shown in the dashboard.
3. Go to the [Sui Discord Faucet](https://discord.gg/sui) (`#testnet-faucet` channel) and type:
   `!faucet <YOUR_ADDRESS>`
4. Click **Refresh** in the app to see your balance.
