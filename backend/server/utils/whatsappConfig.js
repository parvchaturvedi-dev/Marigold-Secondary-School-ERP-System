import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const getEncryptionKey = () => {
  const value = String(process.env.WHATSAPP_CONFIG_ENCRYPTION_KEY || '').trim();
  if (!/^[a-f\d]{64}$/i.test(value)) {
    throw new Error('WHATSAPP_CONFIG_ENCRYPTION_KEY must be a 64-character hexadecimal key.');
  }
  return Buffer.from(value, 'hex');
};

export const encryptWhatsAppConfig = (config) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(config), 'utf8'),
    cipher.final(),
  ]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
};

export const decryptWhatsAppConfig = ({ config_ciphertext, config_iv, config_auth_tag }) => {
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), config_iv);
  decipher.setAuthTag(config_auth_tag);
  const plaintext = Buffer.concat([
    decipher.update(config_ciphertext),
    decipher.final(),
  ]).toString('utf8');
  return JSON.parse(plaintext);
};
