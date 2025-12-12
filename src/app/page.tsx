"use client";

import { useState, useEffect } from "react";
import { useTurnkey, AuthState, ClientState } from "@turnkey/react-wallet-kit";

export default function Home() {
  const { user, handleLogin, logout, authState, clientState } = useTurnkey();

  // --- WALLET STATE ---
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // --- TRANSFER STATE ---
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("0.01");
  const [txStatus, setTxStatus] = useState("");

  // --- GENERIC MOVE CALL STATE ---
  const [moveTarget, setMoveTarget] = useState("0x2::pay::split_and_transfer");
  const [moveTypeArgs, setMoveTypeArgs] = useState('["0x2::sui::SUI"]');
  // Pre-fill with arguments for the Devnet NFT example
  const [moveArgs, setMoveArgs] = useState(
    JSON.stringify(
      [
        { kind: "gas" },
        { kind: "u64", value: "100" },
        { kind: "address", value: "0x..." },
      ],
      null,
      2
    )
  );
  const [moveStatus, setMoveStatus] = useState("");

  const isLoggedIn = authState === AuthState.Authenticated;

  // Fetch wallet when user logs in
  useEffect(() => {
    if (isLoggedIn) {
      fetchWallet();
    } else {
      setWallet(null);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (wallet?.address) {
      // Update the "value" of the 3rd argument to be our own address
      setMoveArgs((prev) => {
        const args = JSON.parse(prev);
        if (args[2].kind === "address") {
          args[2].value = wallet.address;
        }
        return JSON.stringify(args, null, 2);
      });
    }
  }, [wallet]);

  // 1. Fetch Wallet Data
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

  // 2. Handle Simple Transfer
  const handleTransfer = async () => {
    setTxStatus("Sending...");
    try {
      const res = await fetch("/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: recipient, amount }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setTxStatus(`Success! Digest: ${data.digest}`);
      fetchWallet(); // Refresh balance
    } catch (e: any) {
      setTxStatus(`Error: ${e.message}`);
    }
  };

  // 3. Handle Generic Move Call
  const handleMoveCall = async () => {
    setMoveStatus("Executing...");
    try {
      let parsedArgs;
      let parsedTypeArgs;
      try {
        parsedArgs = JSON.parse(moveArgs);
        parsedTypeArgs = JSON.parse(moveTypeArgs);
      } catch (e) {
        throw new Error("Invalid JSON in Arguments or Type Arguments field");
      }

      const res = await fetch("/api/move-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: moveTarget,
          typeArguments: parsedTypeArgs,
          args: parsedArgs,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setMoveStatus(`Success! Digest: ${data.digest}`);
      fetchWallet();
    } catch (e: any) {
      setMoveStatus(`Error: ${e.message}`);
    }
  };

  // --- RENDER: LOADING SCREEN ---
  if (clientState !== ClientState.Ready) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-400">Initializing Turnkey...</p>
      </main>
    );
  }

  // --- RENDER: MAIN APP ---
  return (
    <main className="flex min-h-screen flex-col items-center p-24 bg-gray-950 text-white">
      <h1 className="text-4xl font-bold mb-8">Sui + Turnkey (Google Auth)</h1>

      {!user ? (
        // --- LOGIN VIEW ---
        <div className="text-center space-y-4">
          <p className="text-gray-400">Please sign in to access the wallet</p>
          <button
            onClick={() => handleLogin()}
            className="px-6 py-3 bg-white text-black hover:bg-gray-200 rounded-lg font-bold flex items-center gap-2 mx-auto transition-all"
          >
            <img
              src="https://www.svgrepo.com/show/475656/google-color.svg"
              className="w-6 h-6"
              alt="Google"
            />
            Sign in with Google
          </button>
        </div>
      ) : (
        // --- DASHBOARD VIEW ---
        <div className="w-full max-w-lg space-y-6">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-green-400">Logged in via Google</p>
            <button
              onClick={() => logout()}
              className="text-xs text-gray-500 underline hover:text-gray-300"
            >
              Logout
            </button>
          </div>

          {/* 1. WALLET CARD */}
          <div className="p-6 border border-gray-700 rounded-xl bg-gray-900 shadow-lg">
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

          {/* 2. SIMPLE TRANSFER CARD */}
          <div className="p-6 border border-gray-700 rounded-xl bg-gray-900 shadow-lg">
            <h2 className="text-xl font-bold mb-4">Simple Transfer</h2>
            <div className="space-y-4">
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full p-2 rounded bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none transition-colors"
                placeholder="Recipient Address (0x...)"
              />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full p-2 rounded bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none transition-colors"
                placeholder="Amount (SUI)"
              />
              <button
                onClick={handleTransfer}
                disabled={loading}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded font-bold disabled:opacity-50 transition-colors"
              >
                Send SUI
              </button>
              {txStatus && (
                <div className="p-2 bg-gray-800 rounded text-sm break-all border border-gray-700">
                  {txStatus}
                </div>
              )}
            </div>
          </div>

          {/* GENERIC MOVE CALL CARD */}
          <div className="p-6 border border-gray-700 rounded-xl bg-gray-900 shadow-lg">
            <h2 className="text-xl font-bold mb-2">Generic Move Call</h2>
            <p className="text-xs text-gray-400 mb-4">
              Execute any contract function. Defaults to <code>pay::split_and_transfer</code> (sending SUI via Move).
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Target (Package::Module::Function)</label>
                <input
                  type="text"
                  value={moveTarget}
                  onChange={(e) => setMoveTarget(e.target.value)}
                  className="w-full p-2 rounded bg-gray-800 border border-gray-700 font-mono text-sm focus:border-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Type Arguments (JSON Array)</label>
                <input
                  type="text"
                  value={moveTypeArgs}
                  onChange={(e) => setMoveTypeArgs(e.target.value)}
                  className="w-full p-2 rounded bg-gray-800 border border-gray-700 font-mono text-xs focus:border-purple-500 outline-none text-gray-300"
                  placeholder='["0x2::sui::SUI"]'
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Arguments (JSON Array)</label>
                <textarea
                  value={moveArgs}
                  onChange={(e) => setMoveArgs(e.target.value)}
                  className="w-full p-2 h-32 rounded bg-gray-800 border border-gray-700 font-mono text-xs focus:border-purple-500 outline-none"
                />
              </div>

              <button
                onClick={handleMoveCall}
                disabled={loading}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 rounded font-bold disabled:opacity-50 transition-colors"
              >
                Execute Move Call
              </button>

              {moveStatus && (
                <div className="p-2 bg-gray-800 rounded text-sm break-all border border-gray-700">
                  {moveStatus}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}