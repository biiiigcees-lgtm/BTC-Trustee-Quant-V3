// Kalshi JWT Signature Implementation
// Generates JWT tokens for Kalshi API authentication using RSA private key

import crypto from 'crypto';

export interface KalshiJWTConfig {
  keyId: string;
  privateKey: string;
}

export interface KalshiJWTClaims {
  sub: string; // key_id
  iat: number; // issued at
  exp: number; // expiration
}

/**
 * Generate JWT signature for Kalshi API authentication
 * Kalshi uses RS256 (RSA with SHA-256) algorithm
 */
export class KalshiJWT {
  private config: KalshiJWTConfig;

  constructor(config: KalshiJWTConfig) {
    this.config = config;
  }

  /**
   * Generate a JWT token
   * @param expiresIn - Token expiration time in seconds (default: 60)
   */
  generateToken(expiresIn: number = 60): string {
    const now = Math.floor(Date.now() / 1000);
    
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    const payload: KalshiJWTClaims = {
      sub: this.config.keyId,
      iat: now,
      exp: now + expiresIn,
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = this.signRS256(signatureInput);
    
    return `${signatureInput}.${signature}`;
  }

  /**
   * Sign data using RS256 (RSA with SHA-256)
   */
  private signRS256(data: string): string {
    try {
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(data);
      sign.end();
      
      const signature = sign.sign(this.config.privateKey, 'base64');
      return this.base64UrlEncode(signature);
    } catch (error) {
      console.error('Failed to sign JWT:', error);
      throw new Error('JWT signature failed');
    }
  }

  /**
   * Base64 URL-safe encoding
   */
  private base64UrlEncode(str: string): string {
    return Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Get authorization header value
   */
  getAuthHeader(): string {
    const token = this.generateToken();
    return `Bearer ${token}`;
  }
}

/**
 * Singleton instance for global use
 */
let kalshiJWT: KalshiJWT | null = null;

export function getKalshiJWT(): KalshiJWT | null {
  if (!kalshiJWT) {
    const keyId = process.env.KALSHI_KEY_ID;
    const privateKey = process.env.KALSHI_PRIVATE_KEY;

    if (!keyId || !privateKey) {
      console.warn('Kalshi JWT credentials not configured');
      return null;
    }

    kalshiJWT = new KalshiJWT({ keyId, privateKey });
  }

  return kalshiJWT;
}
