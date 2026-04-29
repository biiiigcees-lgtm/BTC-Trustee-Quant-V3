// Novu Push Notification Integration
// Sends push notifications for safe bet alerts on KXBTC15M contracts

export interface NotificationConfig {
  novuApiKey: string;
  novuAppId?: string;
  templateId?: string;
}

export interface SafeBetNotification {
  userId: string;
  deviceToken: string;
  ticker: string;
  contractType: 'ABOVE' | 'BELOW';
  strikePrice: number;
  currentPrice: number;
  confidence: number;
  predictedProbability: number;
  expiryTime: number;
  reason: string;
}

export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  error?: string;
}

/**
 * Novu Notification Service
 * 
 * Integrates with Novu to send push notifications for high-confidence safe bets.
 * Requires Novu API key and configured push provider (Firebase/OneSignal).
 */
export class NovuNotificationService {
  private readonly config: NotificationConfig;
  private readonly apiUrl = 'https://api.novu.co/v1';

  constructor(config: NotificationConfig) {
    this.config = config;
  }

  /**
   * Send safe bet notification to user
   */
  async sendSafeBetAlert(notification: SafeBetNotification): Promise<NotificationResult> {
    try {
      // Use default template if none provided
      const templateId = this.config.templateId || 'safe-bet-alert';

      const payload = {
        to: {
          subscriberId: notification.userId,
          deviceTokens: [notification.deviceToken],
        },
        templateId,
        payload: {
          ticker: notification.ticker,
          contractType: notification.contractType,
          strikePrice: notification.strikePrice.toFixed(2),
          currentPrice: notification.currentPrice.toFixed(2),
          confidence: notification.confidence,
          predictedProbability: (notification.predictedProbability * 100).toFixed(1),
          expiryTime: new Date(notification.expiryTime).toISOString(),
          reason: notification.reason,
        },
      };

      const response = await fetch(`${this.apiUrl}/events/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `ApiKey ${this.config.novuApiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Novu API error: ${errorData.message || response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        notificationId: data.data?.transactionId,
      };
    } catch (error) {
      console.error('Failed to send Novu notification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Register user device token for push notifications
   */
  async registerDeviceToken(
    userId: string,
    deviceToken: string,
    platform: 'ios' | 'android' | 'web'
  ): Promise<NotificationResult> {
    try {
      const payload = {
        subscriberId: userId,
        device: {
          token: deviceToken,
          platform,
        },
      };

      const response = await fetch(`${this.apiUrl}/subscribers/${userId}/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `ApiKey ${this.config.novuApiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Novu API error: ${errorData.message || response.statusText}`);
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error('Failed to register device token:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create subscriber in Novu
   */
  async createSubscriber(
    userId: string,
    email?: string,
    firstName?: string,
    lastName?: string
  ): Promise<NotificationResult> {
    try {
      const payload = {
        subscriberId: userId,
        email,
        firstName,
        lastName,
      };

      const response = await fetch(`${this.apiUrl}/subscribers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `ApiKey ${this.config.novuApiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Novu API error: ${errorData.message || response.statusText}`);
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error('Failed to create subscriber:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if Novu is configured
   */
  isConfigured(): boolean {
    return !!this.config.novuApiKey;
  }
}

/**
 * Singleton instance for global use
 * Initialized with environment variables if available
 */
let novuService: NovuNotificationService | null = null;

export function getNovuService(): NovuNotificationService | null {
  if (!novuService && process.env.NOVU_API_KEY) {
    novuService = new NovuNotificationService({
      novuApiKey: process.env.NOVU_API_KEY,
      novuAppId: process.env.NOVU_APP_ID,
      templateId: process.env.NOVU_SAFE_BET_TEMPLATE_ID,
    });
  }
  return novuService;
}

/**
 * Helper function to send safe bet alert
 * Automatically checks if Novu is configured before sending
 */
export async function sendSafeBetAlert(
  notification: SafeBetNotification
): Promise<NotificationResult> {
  const service = getNovuService();

  if (!service) {
    console.warn('Novu service not configured, skipping notification');
    return {
      success: false,
      error: 'Novu service not configured',
    };
  }

  return service.sendSafeBetAlert(notification);
}
