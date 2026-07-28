#!/usr/bin/env node

import webPush from "web-push";

const keys = webPush.generateVAPIDKeys();

console.log("\nDaily Reset VAPID keys\n");
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(
  "VAPID_SUBJECT=mailto:YOUR_EMAIL@example.com"
);
console.log(
  "\nSave these in .env.local and in Vercel. Keep the private key server-only.\n"
);
