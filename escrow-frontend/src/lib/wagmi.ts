import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi"; // <--- ADD THIS
import { mainnet } from "wagmi/chains";

// Fetch the project ID from environment variables.
// Users running this demo locally should create their own Project ID at cloud.reown.com
// and define NEXT_PUBLIC_WC_PROJECT_ID in their .env.local file.
const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WC_PROJECT_ID || "fb56fb90c391038f9a2ffbce64d9268d";

if (!process.env.NEXT_PUBLIC_WC_PROJECT_ID) {
  console.warn(
    "Wagmi Warning: NEXT_PUBLIC_WC_PROJECT_ID is not configured in environment variables. " +
      "WalletConnect might throw allowlist/origin errors on localhost. " +
      "Please create an app at https://cloud.reown.com and set NEXT_PUBLIC_WC_PROJECT_ID in .env.local"
  );
}

export const config = getDefaultConfig({
  appName: "SecureEscrow",
  projectId: walletConnectProjectId,
  chains: [mainnet],
  transports: { // <--- ADD THIS ENTIRE BLOCK
    [mainnet.id]: http('https://eth-mainnet.g.alchemy.com/v2/alch_rFp0ammisNNtNTQS7gCDH'),
  },
  ssr: true,
});
