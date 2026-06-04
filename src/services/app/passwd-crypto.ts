const IMPORT_PASSPHRASE = "ai-api-hub-config-import-gate";
const IMPORT_SALT = new TextEncoder().encode("ai-api-hub-salt");

async function deriveCryptoKey(passphrase: string, usage: KeyUsage[]): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: IMPORT_SALT, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    usage,
  );
}

function normalizeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  return padding ? `${normalized}${"=".repeat(4 - padding)}` : normalized;
}

export async function decryptImportPassword(base64urlCiphertext: string): Promise<string> {
  const key = await deriveCryptoKey(IMPORT_PASSPHRASE, ["decrypt"]);
  const raw = Uint8Array.from(window.atob(normalizeBase64Url(base64urlCiphertext)), (c) => c.charCodeAt(0));
  const iv = raw.slice(0, 12);
  const ciphertext = raw.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

export async function verifyImportPassword(input: string, encryptedPassword: string): Promise<string | null> {
  try {
    const decrypted = await decryptImportPassword(encryptedPassword);
    return decrypted === input ? decrypted : null;
  } catch {
    return null;
  }
}

export async function encryptImportPassword(plaintext: string): Promise<string> {
  const key = await deriveCryptoKey(IMPORT_PASSPHRASE, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
