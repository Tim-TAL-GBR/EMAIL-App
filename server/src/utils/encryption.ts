import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  console.error("[encryption] CRITICAL: ENCRYPTION_KEY env var is missing or too short. Set it to a 32+ char string.");
}

const key = Buffer.alloc(32, ENCRYPTION_KEY || '');

export function encrypt(text: string): string {
  if (!text) return text;
  
  // Prevent double encryption
  if (text.includes(':')) {
    const parts = text.split(':');
    if (parts.length === 3) {
      // Basic check if all parts are hex
      const isHex = (str: string) => /^[0-9a-f]+$/i.test(str);
      if (isHex(parts[0]) && isHex(parts[1]) && isHex(parts[2])) {
        return text;
      }
    }
  }
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(text: string): string {
  if (!text) return text;
  
  try {
    const parts = text.split(':');
    if (parts.length !== 3) {
      return text;
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    return text;
  }
}
