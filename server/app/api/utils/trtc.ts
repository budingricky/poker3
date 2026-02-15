import { Api } from 'tls-sig-api-v2';

// TODO: Replace with your actual SDKAppID and SecretKey from Tencent Cloud Console
// https://console.cloud.tencent.com/trtc
const SDKAPPID = 1600126725; 
const SECRETKEY = '674335bae281ba34317a48d7b4ff6a7d454cd635bca827eeaf6c94eaa520dbbe';

export function generateUserSig(userId: string): { userSig: string, sdkAppId: number } {
  if (SDKAPPID === 0 || !SECRETKEY) {
    // Return a dummy value if not configured, client should handle this gracefully (e.g. show warning)
    // Or throw error
    throw new Error('TRTC SDKAppID or SecretKey not configured in server/app/api/utils/trtc.ts');
  }
  const api = new Api(SDKAPPID, SECRETKEY);
  const userSig = api.genUserSig(userId, 86400*7); // 7 days
  return { userSig, sdkAppId: SDKAPPID };
}
