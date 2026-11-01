import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
export const opaque = () => randomBytes(32).toString('base64url');
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export class TokenVault {
    private key: Buffer;
    constructor(secret: string) {
        if (secret.length < 32) throw new Error('TOKEN_ENCRYPTION_KEY must contain at least 32 random characters.');
        this.key = createHash('sha256').update(secret).digest();
    }
    seal(value: unknown) {
        const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key, iv);
        const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
        return [iv, cipher.getAuthTag(), encrypted].map(x => x.toString('base64url')).join('.');
    }
    open<T>(value: string): T {
        const [iv, tag, body] = value.split('.').map(x => Buffer.from(x, 'base64url'));
        const cipher = createDecipheriv('aes-256-gcm', this.key, iv!); cipher.setAuthTag(tag!);
        return JSON.parse(Buffer.concat([cipher.update(body!), cipher.final()]).toString('utf8'));
    }
}
