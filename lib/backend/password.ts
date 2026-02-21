import crypto from "node:crypto";

const PASSWORD_SCRYPT_COST = 16384;
const PASSWORD_KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = (await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      PASSWORD_KEYLEN,
      { N: PASSWORD_SCRYPT_COST },
      (err, key) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(key as Buffer);
      }
    );
  })).toString("hex");

  return `scrypt$${PASSWORD_SCRYPT_COST}$${salt}$${derivedKey}`;
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter.";
  }
  if (!/\d/.test(password)) {
    return "Password must include at least one number.";
  }
  return null;
}

