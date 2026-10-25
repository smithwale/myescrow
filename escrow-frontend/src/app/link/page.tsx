"use client";
import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";

export default function LinkPage() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [discordId, setDiscordId] = useState("");
  const [status, setStatus] = useState("");

  const handleLink = async () => {
    if (!address || !discordId) return;
    setStatus("Waiting for signature...");
    
    try {
      const message = `I am linking my Discord ID ${discordId} to my wallet ${address}.`;
      const signature = await signMessageAsync({ message });

      setStatus("Verifying on server...");
      const res = await fetch("/api/link-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordId, walletAddress: address, signature, message }),
      });

      if (res.ok) {
        setStatus("✅ Successfully linked! You can close this window and return to Discord.");
      } else {
        setStatus("❌ Failed to verify signature.");
      }
    } catch (error) {
      setStatus("❌ Signature rejected or failed.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
      <div className="bg-slate-800 p-8 rounded-xl shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4 text-center">Link Wallet to Discord</h1>
        <p className="text-gray-400 mb-6 text-sm text-center">
          Enter your Discord User ID and sign the message to prove you own this wallet.
        </p>

        <input 
          type="text" 
          placeholder="Discord User ID (e.g., 123456789012345678)" 
          className="w-full p-3 mb-4 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-indigo-500"
          value={discordId}
          onChange={(e) => setDiscordId(e.target.value)}
        />
        
        <button 
          onClick={handleLink}
          disabled={!isConnected || !discordId}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded disabled:opacity-50 transition-colors"
        >
          {isConnected ? "Sign Message & Link" : "Connect Wallet First"}
        </button>

        {status && (
          <p className="mt-4 text-center text-sm font-medium text-indigo-400">{status}</p>
        )}
      </div>
    </div>
  );
}