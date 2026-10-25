import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL as string,
  token: process.env.KV_REST_API_TOKEN as string,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("EXACT ACTION RECEIVED:", body.action); // <--- ADD THIS
    const { escrowId, buyerWallet, sellerWallet, amount, winnerWallet } = body;
    const action = body.action?.toLowerCase();

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });

    // 🚨 THE SECURE LOOKUP: Find the Discord ID tied to this wallet
    let discordTag = buyerWallet; // Fallback to just showing the wallet address
    if (buyerWallet) {
      const linkedDiscordId = await redis.get(`wallet:${buyerWallet.toLowerCase()}`);
      if (linkedDiscordId) {
        discordTag = `<@${linkedDiscordId}>`; // This creates a clickable Discord tag
      }
    }

    // Format the message for Discord
    let message = "";

    if (action === "created") {
      message = `🚀 **New Escrow Created!**\n**By:** ${discordTag}\n**ID:** #${escrowId}\n**Seller:** \`${sellerWallet}\`\n**Amount:** ${amount} ETH`;
    } 
    else if (action === "funded") {
      message = `💰 **Escrow Funded!**\n**By:** ${discordTag}\n**ID:** #${escrowId}\n**Amount:** ${amount} ETH is now locked.`;
    } 
    else if (action === "rendered") {
      message = `📦 **Service Rendered!**\n**ID:** #${escrowId}\nThe Seller has marked the item as delivered. The Buyer can now review and release the funds.`;
    }
    else if (action === "disputed") {
      message = `⚠️ **DISPUTE OPENED!**\n**By:** ${discordTag}\n**ID:** #${escrowId}\n**Admin intervention required!** The funds are locked until resolved.`;
    } 
    else if (action === "released") {
      message = `🎉 **Escrow Completed!**\n**ID:** #${escrowId}\n**Amount:** ${amount} ETH has been successfully released.\n**Status:** Completed ✅`;
    }
    else if (action === "settled") {
      message = `⚖️ **Dispute Settled by Admin!**\n**ID:** #${escrowId}\nThe Admin has resolved the dispute.\n**Winner:** \`${winnerWallet}\`\nThe funds have been released to the winner.`;
    }
    else {
      // Fallback for unknown actions so Discord doesn't reject the empty message
      message = `🔄 **Escrow Update:**\n**ID:** #${escrowId}\nAction: ${action}\nAmount: ${amount || "Unknown"} ETH`;
    }
    console.log("SENDING TO DISCORD:", message);
    // Send the message to Discord
    const discordResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
    });
    // 🚨 ADD THIS: Check if Discord actually accepted the message
    if (!discordResponse.ok) {
      const errorText = await discordResponse.text();
      console.error("Discord rejected the message:", errorText);
      return NextResponse.json({ error: "Discord API failed", details: errorText }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to notify" }, { status: 500 });
  }
}