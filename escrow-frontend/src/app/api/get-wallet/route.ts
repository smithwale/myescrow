import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL as string,
  token: process.env.KV_REST_API_TOKEN as string,
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const discordId = searchParams.get('discordId');
  
  if (!discordId) {
    return NextResponse.json({ error: "Missing Discord ID" }, { status: 400 });
  }

  // Look up the wallet address in the database
  const wallet = await redis.get(`discord:${discordId}`);
  
  return NextResponse.json({ wallet });
}