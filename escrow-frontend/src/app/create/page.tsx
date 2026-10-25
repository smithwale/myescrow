"use client";
import { parseEventLogs, parseEther } from "viem"; // Add this import at the top
import { escrowAbi } from "@/lib/generated";
import { useSearchParams, useRouter } from "next/navigation";
import { useAccount, useWaitForTransactionReceipt } from "wagmi";
import { useWriteEscrowCreateEscrow } from "@/lib/generated";
import { CONTRACT_ADDRESS } from "@/constants";
import { useState, useEffect, useRef, Suspense } from "react";


function CreateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [status, setStatus] = useState("");

  // Add this below your status state on line 13
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);

  const seller = searchParams.get("seller");
  const amount = searchParams.get("amount");

  const { writeContractAsync: createEscrow } = useWriteEscrowCreateEscrow();
  // --- ADD STEP 4 HERE ---
  const { 
  data: receipt, // 👈 Add this to get the transaction receipt
  isLoading: isConfirming, 
  isSuccess: isConfirmed 
  } = useWaitForTransactionReceipt({ hash: txHash });
  
// -----------------------

// Add this ref to prevent double-firing in React Strict Mode
const hasProcessedSuccess = useRef(false);

// ... inside CreateContent ...
  useEffect(() => {
  // We check if receipt exists to ensure we don't try to parse undefined
  if (isConfirmed && receipt && !hasProcessedSuccess.current) {
    hasProcessedSuccess.current = true; 

    const notifyBot = async () => {
      try {
        // 1. Get the real escrowId from the transaction receipt
        let realEscrowId = "Unknown";
        
        if (receipt.logs) {
          const logs = parseEventLogs({
            abi: escrowAbi, 
            eventName: "EscrowCreated",
            logs: receipt.logs,
          });
          
          if (logs.length > 0) {
            // TypeScript might complain about logs[0].args.escrowId, 
            // if so, you can cast it to 'any' or the specific type.
            realEscrowId = (logs[0] as any).args.escrowId.toString();
          }
        }

        // 2. Call YOUR OWN Next.js API route
        await fetch("/api/notify-bot", { 
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            escrowId: realEscrowId, 
            buyerWallet: address,     
            sellerWallet: seller,     
            amount: amount,
            action: "Funded"          
          })
        });
      } catch (error) {
        console.error("Failed to notify Discord bot:", error);
      }
    };

    notifyBot();

    // Redirect to dashboard
    setTimeout(() => {
      router.push("/"); 
    }, 2000);
  }
}, [isConfirmed, receipt, router, seller, amount, address]); // Clean dependency array

const handlePay = async () => {
  // 1. Guard clause to ensure seller and amount exist
  if (!seller || !amount) {
    setStatus("Missing seller or amount parameters.");
    return;
  }
  
  setStatus("Creating and Funding Escrow...");

  try {
    // 2. Send the transaction WITH the value attached
    const hash = await createEscrow({
      address: CONTRACT_ADDRESS as `0x${string}`,
      args: [seller as `0x${string}`],
      // 👇 This is the line that fixes the Anvil error
      value: parseEther(amount as string), 
    });

    // 3. Save the hash to state so the UI waits for it
    setTxHash(hash);
    setStatus("Waiting for blockchain confirmation...");

  } catch (error: any) {
    console.error("Transaction Error:", error);
    // If MetaMask rejects it, or if the contract reverts
    setStatus(error.shortMessage || "Transaction failed or rejected.");
    setTxHash(undefined); // Reset hash so they can try again
  }
};

  if (!seller || !amount) {
    return <div className="text-center text-white mt-20">Invalid Link.</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
      <div className="bg-slate-800 p-8 rounded-xl shadow-lg max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4">Complete Escrow Payment</h1>
        <p className="mb-2"><strong>Seller:</strong> {seller}</p>
        <p className="mb-6"><strong>Amount:</strong> {amount} ETH</p>

        {!isConnected ? (
      <p className="text-yellow-400">Please connect your wallet using the button in the top right.</p>
    ) : isConfirmed ? (
      // 1. Success State
      <div className="w-full bg-green-600 text-white font-bold py-3 rounded mt-4">
        ✅ Escrow Created and Funded!
      </div>
    ) : (
      // 2. Button State (Normal & Confirming)
      <button
        onClick={handlePay}
        disabled={isConfirming || status.includes("ing")}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded disabled:opacity-50 transition-colors"
      >
        {isConfirming
          ? "Waiting for blockchain confirmation..."
          : (status ? status : "Create Escrow")}
      </button>
    )}
      </div>
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="text-white text-center mt-20">Loading...</div>}>
      <CreateContent />
    </Suspense>
  );
}