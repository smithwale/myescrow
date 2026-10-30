"use client";
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import {
  useReadEscrowEscrows,
  useReadEscrowAdmin,
  useWriteEscrowFundEscrow,
  useWriteEscrowRenderService,
  useWriteEscrowReleaseFunds,
  useWriteEscrowOpenDispute,
  useWatchEscrowEscrowFundedEvent,
  useWatchEscrowServiceRenderedEvent,
  useWatchEscrowEscrowCompletedEvent,
  useWatchEscrowEscrowDisputedEvent,
  useWatchEscrowEscrowSettledEvent,
} from "@/lib/generated";
import { CONTRACT_ADDRESS } from "@/constants";
import { formatEther } from "viem";
import { toast } from "react-hot-toast";
import { EscrowChat } from "@/components/EscrowChat";

const STATUS_MAP = ["Created", "Funded", "ServiceRendered", "Completed", "Disputed"] as const;

const EscrowPage = () => {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const escrowId = BigInt(id || "0");
  
  const { address: account } = useAccount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Read Escrow Data
  const { data: escrowData, isLoading: isReading, refetch: refetchEscrow } = useReadEscrowEscrows({
    address: CONTRACT_ADDRESS as `0x${string}`,
    args: [escrowId],
    query: { enabled: !!id },
  });

  // Read Admin
  const { data: adminAddress } = useReadEscrowAdmin({
    address: CONTRACT_ADDRESS as `0x${string}`,
  });

  // Watch Events to auto-refresh
  const eventConfig = {
    address: CONTRACT_ADDRESS as `0x${string}`,
    onLogs() { refetchEscrow(); },
  };
  useWatchEscrowEscrowFundedEvent(eventConfig);
  useWatchEscrowServiceRenderedEvent(eventConfig);
  useWatchEscrowEscrowCompletedEvent(eventConfig);
  useWatchEscrowEscrowDisputedEvent(eventConfig);
  useWatchEscrowEscrowSettledEvent(eventConfig);

  // Write Hooks (No .wait() needed here, wagmi handles the state)
  const { writeContractAsync: fundEscrow, isPending: isFunding } = useWriteEscrowFundEscrow();
  const { writeContractAsync: renderService, isPending: isRendering } = useWriteEscrowRenderService();
  const { writeContractAsync: releaseFunds, isPending: isReleasing } = useWriteEscrowReleaseFunds();
  const { writeContractAsync: openDispute, isPending: isDisputing } = useWriteEscrowOpenDispute();

  const isPending = isFunding || isRendering || isReleasing || isDisputing;

  const handleAction = async (action: string) => {
  if (!id) return;
  const toastId = toast.loading(`${action} in progress...`);

  try {
    if (action === "fund") {
      await fundEscrow({ 
        address: CONTRACT_ADDRESS as `0x${string}`, 
        args: [escrowId] 
      });
      
      await fetch('/api/notify-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'funded', 
          escrowId: escrowId.toString(), 
          buyerWallet: account, // <--- ADDED
          amount: escrowData?.[2] ? formatEther(escrowData[2]) : "Unknown" 
        }),
      });
    } 
    else if (action === "renderService") {
      await renderService({ 
        address: CONTRACT_ADDRESS as `0x${string}`, 
        args: [escrowId] 
      });

      await fetch('/api/notify-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'rendered', 
          escrowId: escrowId.toString(),
          buyerWallet: account // <--- ADDED
        }),
      });
    } 
    else if (action === "releaseFunds") {
      await releaseFunds({ 
        address: CONTRACT_ADDRESS as `0x${string}`, 
        args: [escrowId] 
      });

      await fetch('/api/notify-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'released', 
          escrowId: escrowId.toString(), 
          buyerWallet: account, // <--- ADDED
          amount: escrowData?.[2] ? formatEther(escrowData[2]) : "Unknown" 
        }),
      });
    } 
    else if (action === "openDispute") {
      await openDispute({ 
        address: CONTRACT_ADDRESS as `0x${string}`, 
        args: [escrowId] 
      });

      await fetch('/api/notify-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'disputed', 
          escrowId: escrowId.toString(),
          buyerWallet: account // <--- ADDED
        }),
      });
    }

    toast.success(`${action} transaction sent!`, { id: toastId });
    refetchEscrow();
  } catch (error: any) {
    console.error(error);
    toast.error(`Error: ${error.message || "Transaction failed"}`, { id: toastId });
  }
};

  if (!mounted || isReading) return <div className="text-center py-12">Loading...</div>;
  if (!escrowData || escrowData[0] === "0x0000000000000000000000000000000000000000") return <div className="text-center py-12 text-red-500">Escrow not found</div>;

  const [buyer, seller, amount, statusNum] = escrowData;
  const status = STATUS_MAP[statusNum] || "Unknown";
  const isBuyer = account?.toLowerCase() === buyer.toLowerCase();
  const isSeller = account?.toLowerCase() === seller.toLowerCase();

  return (
    <div className="max-w-4xl mx-auto space-y-8 mt-6">
      <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-xl backdrop-blur-md">
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-white">Escrow #{id}</h1>
          <span className="px-4 py-1 rounded-full text-sm font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            {status}
          </span>
        </div>

        <div className="space-y-3 mb-8 text-gray-300">
          <p><strong>Seller:</strong> {seller}</p>
          <p><strong>Buyer:</strong> {buyer}</p>
          <p><strong>Amount:</strong> <span className="text-2xl font-bold text-indigo-400">{formatEther(amount)} ETH</span></p>
        </div>

        <div className="flex gap-4 flex-wrap">
          {status === "Created" && isBuyer && (
            <button onClick={() => handleAction("fund")} disabled={isPending} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold disabled:opacity-50">
              {isFunding ? "Funding..." : "Fund Escrow"}
            </button>
          )}
          
          {status === "Funded" && isSeller && (
            <button onClick={() => handleAction("renderService")} disabled={isPending} className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-lg font-bold disabled:opacity-50">
              {isRendering ? "Processing..." : "Mark as Delivered"}
            </button>
          )}

          {status === "Funded" && isBuyer && (
              <button onClick={() => handleAction("openDispute")} disabled={isPending} className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold disabled:opacity-50">
                {isDisputing ? "Opening..." : "Open Dispute (Seller Not Responding)"}
              </button>
          )}


          {status === "ServiceRendered" && isBuyer && (
            <button onClick={() => handleAction("releaseFunds")} disabled={isPending} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold disabled:opacity-50">
              {isReleasing ? "Releasing..." : "Release Funds"}
            </button>
          )}

          {status === "ServiceRendered" && (isBuyer || isSeller) && (
            <button onClick={() => handleAction("openDispute")} disabled={isPending} className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold disabled:opacity-50">
              {isDisputing ? "Opening..." : "Open Dispute"}
            </button>
          )}
        </div>
      </div>

      
  <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-xl flex flex-col items-center justify-center text-center backdrop-blur-md w-full">
  <h3 className="text-xl font-bold text-white mb-4">Escrow Status</h3>
  
  {status === "Created" && (
    <>
      <div className="text-4xl mb-4">⏳</div>
      <p className="text-gray-400 mb-2">This escrow has been created but is not yet funded.</p>
      <p className="text-gray-400">Click <strong>Fund Escrow</strong> above to lock the funds into the smart contract.</p>
    </>
  )}

  {status === "Funded" && (
    <>
      <div className="text-4xl mb-4">🔒</div>
      <p className="text-gray-400 mb-2">Funds are securely locked in the smart contract!</p>
      <p className="text-gray-400">The Seller can now complete the work and click <strong>Mark as Delivered</strong>.</p>
    </>
  )}

  {status === "ServiceRendered" && (
    <>
      <div className="text-4xl mb-4">📦</div>
      <p className="text-gray-400 mb-2">The Seller has marked this item as delivered.</p>
      <p className="text-gray-400">The Buyer should review the work and click <strong>Release Funds</strong>.</p>
    </>
  )}

  {status === "Completed" && (
    <>
      <div className="text-4xl mb-4">🎉</div>
      <p className="text-green-400 font-bold mb-2">Escrow Completed!</p>
      <p className="text-gray-400">The funds have been successfully released.</p>
    </>
  )}

  {status === "Disputed" && (
    <>
      <div className="text-4xl mb-4">⚠️</div>
      <p className="text-red-400 font-bold mb-2">Dispute Opened</p>
      <p className="text-gray-400">The funds are frozen. The Admin will review this escrow and decide where the funds go.</p>
    </>
  )}
</div>
{/* 👆 END OF STATUS CARD 👆 */}

      <EscrowChat 
        escrowId={Number(escrowId)} 
        buyer={buyer} 
        seller={seller} 
        admin={adminAddress as `0x${string}`} 
      />

    </div>
  );
};

export default EscrowPage;