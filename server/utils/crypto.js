const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

let aesKey = null;

function initKey(keyString) {
  // 确保密钥正好 32 字节
  aesKey = Buffer.alloc(32);
  Buffer.from(keyString).copy(aesKey, 0, 0, 32);
}

function encrypt(text) {
  if (!aesKey) throw new Error('AES密钥未初始化');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, aesKey, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText) {
  if (!aesKey) throw new Error('AES密钥未初始化');
  const [ivHex, dataHex] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, aesKey, iv);
  let decrypted = decipher.update(dataHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function encryptBuffer(buffer) {
  if (!aesKey) throw new Error('AES密钥未初始化');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

function decryptBuffer(encryptedBuffer) {
  if (!aesKey) throw new Error('AES密钥未初始化');
  const iv = encryptedBuffer.subarray(0, IV_LENGTH);
  const data = encryptedBuffer.subarray(IV_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, aesKey, iv);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

module.exports = { initKey, encrypt, decrypt, encryptBuffer, decryptBuffer };
