import fs from 'fs';
import path from 'path';
import { Vonage } from '@vonage/server-sdk';

export const applicationId = process.env.VONAGE_APPLICATION_ID;
const privateKeyPath = process.env.VONAGE_PRIVATE_KEY_PATH
  ? path.resolve(process.env.VONAGE_PRIVATE_KEY_PATH)
  : null;

if (!applicationId || !privateKeyPath) {
  console.error("Missing required environment variables (VONAGE_APPLICATION_ID or VONAGE_PRIVATE_KEY_PATH).");
  process.exit(1);
}

const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

const vonage = new Vonage({ applicationId, privateKey });

export default vonage;