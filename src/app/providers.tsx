"use client";

import { TurnkeyProvider, TurnkeyProviderConfig } from "@turnkey/react-wallet-kit";

const turnkeyConfig: TurnkeyProviderConfig = {
    apiBaseUrl: "https://api.turnkey.com",
    organizationId: process.env.NEXT_PUBLIC_TURNKEY_ORGANIZATION_ID!,

    passkeyConfig: {
        rpId: "localhost", // Change this to your domain in production
    },

    authProxyConfigId: process.env.NEXT_PUBLIC_TURNKEY_AUTH_PROXY_CONFIG_ID!,

    // Optional: Explicitly enable Google Auth in the Wallet Kit UI
    auth: {
        methods: {
            googleOauthEnabled: true,
            passkeyAuthEnabled: false, // Set to true if you want both options
        },
    },
};

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <TurnkeyProvider config={turnkeyConfig}>
            {children}
        </TurnkeyProvider>
    );
}