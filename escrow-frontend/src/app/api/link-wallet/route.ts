import { NextResponse } from 'next/server';
import { verifyMessage } from 'viem';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL as string,
  token: process.env.KV_REST_API_TOKEN as string,
});

export async function POST(request: Request) {
  try {
    const { discordId, walletAddress, signature, message } = await request.json();

    // 1. Verify the user actually owns the wallet
    const isValidSignature = await verifyMessage({
      address: walletAddress,
      message: message,
      signature: signature,
    });

    if (!isValidSignature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 2. Save the Discord ID and Wallet Address to Upstash
    await redis.set(`discord:${discordId}`, walletAddress);
    await redis.set(`wallet:${walletAddress.toLowerCase()}`, discordId);

    return NextResponse.json({ success: true, message: "Wallet linked!" });
    
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}