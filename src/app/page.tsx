"use client";

import { useState, useEffect } from "react";
import { useTurnkey, AuthState, ClientState } from "@turnkey/react-wallet-kit";

export default function Home() {
  // 2. Extract clientState
  const { user, handleLogin, logout, authState, clientState } = useTurnkey();

  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("0.01");
  const [txStatus, setTxStatus] = useState("");

  const isLoggedIn = authState === AuthState.Authenticated;

  useEffect(() => {
    if (isLoggedIn) {
      fetchWallet();
    } else {
      setWallet(null);
    }
  }, [isLoggedIn]);

  const fetchWallet = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/wallet");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setWallet(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    setTxStatus("Sending...");
    try {
      const res = await fetch("/api/transfer", {
        method: "POST",
        body: JSON.stringify({ to: recipient, amount }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTxStatus(`Success! Digest: ${data.digest}`);
      fetchWallet();
    } catch (e: any) {
      setTxStatus(`Error: ${e.message}`);
    }
  };

  // --- NEW: LOADING SCREEN ---
  // If the SDK isn't ready yet, show a loader instead of the login button
  if (clientState !== ClientState.Ready) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-400">Initializing Turnkey...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-24 bg-gray-950 text-white">
      <h1 className="text-4xl font-bold mb-8">Sui + Turnkey (Google Auth)</h1>

      {!user ? (
        <div className="text-center space-y-4">
          <p className="text-gray-400">Please sign in to access the wallet</p>
          <button
            onClick={() => handleLogin()}
            className="px-6 py-3 bg-white text-black hover:bg-gray-200 rounded-lg font-bold flex items-center gap-2 mx-auto"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="Google" />
            Sign in with Google
          </button>
        </div>
      ) : (
        <div className="w-full max-w-lg space-y-6">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-green-400">Logged in via Google</p>
            <button onClick={() => logout()} className="text-xs text-gray-500 underline">Logout</button>
          </div>

          {/* Wallet Card */}
          <div className="p-6 border border-gray-700 rounded-xl bg-gray-900">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Shared Sui Wallet</h2>
              <button
                onClick={fetchWallet}
                disabled={loading}
                className="text-sm px-3 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded transition-colors disabled:opacity-50"
              >
                {loading ? "Refreshing..." : "↻ Refresh"}
              </button>
            </div>

            {wallet ? (
              <div className="space-y-3 break-all">
                <div>
                  <span className="text-gray-400 text-sm">Balance</span>
                  <p className="text-2xl font-mono text-white">
                    {(Number(wallet.balanceMist) / 1e9).toFixed(4)} SUI
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">Address</span>
                  <p className="text-sm text-gray-300 font-mono bg-gray-950 p-2 rounded border border-gray-800 select-all">
                    {wallet.address}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 italic">Wallet data not loaded</div>
            )}
          </div>

          {/* Transfer Card */}
          <div className="p-6 border border-gray-700 rounded-xl bg-gray-900">
            <h2 className="text-xl font-bold mb-4">Send Testnet SUI</h2>
            <div className="space-y-4">
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full p-2 rounded bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none"
                placeholder="Recipient Address (0x...)"
              />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full p-2 rounded bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none"
                placeholder="Amount"
              />
              <button
                onClick={handleTransfer}
                disabled={loading}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded font-bold disabled:opacity-50"
              >
                Send
              </button>
              {txStatus && <div className="p-2 bg-gray-800 rounded text-sm break-all border border-gray-700">{txStatus}</div>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}