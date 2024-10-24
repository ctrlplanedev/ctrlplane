import crypto from "crypto";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

class AES256EncryptionService {
  private algorithm = "aes-256-cbc";

  constructor(private key: string) {
    if (key.length !== 64 || !/^[0-9a-fA-F]+$/.test(key))
      throw new Error(
        "Invalid key: must be a 64-character hexadecimal string (32 bytes / 256 bits)",
      );
  }

  encrypt(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.algorithm,
      Buffer.from(this.key, "hex"),
      iv,
    );
    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  }

  decrypt(encryptedData: string): string {
    const [ivHex, encryptedText] = encryptedData.split(":");
    if (ivHex == null || encryptedText == null)
      throw new Error("Invalid encrypted data");

    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      Buffer.from(this.key, "hex"),
      iv,
    );
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }
}

export const env = createEnv({
  server: { VARIABLES_AES_256_KEY: z.string().min(64).max(64) },
  runtimeEnv: process.env,
});

export const variablesAES256 = (key = env.VARIABLES_AES_256_KEY) =>
  new AES256EncryptionService(key);
