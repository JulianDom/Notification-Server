import { Injectable, Logger } from '@nestjs/common';
import { BaseMessage } from './dto/send-notification.dto';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

// La Expo Push API acepta como máximo 100 mensajes por request.
const EXPO_BATCH_SIZE = 100;

export interface ExpoPushResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
}

export interface ExpoPushResult {
  successCount: number;
  failureCount: number;
  responses: ExpoPushResponse[];
}

/**
 * Un Expo Push Token no es un token de registro FCM: Firebase Admin SDK lo
 * rechaza con INVALID_REGISTRATION_TOKEN. Las apps Expo que no integran el SDK
 * de Firebase en el cliente (iOS, donde `getDevicePushTokenAsync()` devuelve el
 * token APNs crudo y nadie hace el canje APNs→FCM) registran este tipo de token,
 * que se envía por la Expo Push API — Expo habla con APNs/FCM por su cuenta.
 */
export function isExpoPushToken(token: string): boolean {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger(ExpoPushService.name);

  /**
   * Envía a Expo Push Tokens. Nunca lanza: un fallo se refleja como
   * `failureCount` para que el resultado se pueda combinar con el del envío
   * por Firebase sin abortar el otro canal.
   */
  async send(tokens: string[], firebaseData: BaseMessage): Promise<ExpoPushResult> {
    if (tokens.length === 0) {
      return { successCount: 0, failureCount: 0, responses: [] };
    }

    const result: ExpoPushResult = { successCount: 0, failureCount: 0, responses: [] };

    for (let i = 0; i < tokens.length; i += EXPO_BATCH_SIZE) {
      const batch = tokens.slice(i, i + EXPO_BATCH_SIZE);
      const batchResult = await this.sendBatch(batch, firebaseData);
      result.successCount += batchResult.successCount;
      result.failureCount += batchResult.failureCount;
      result.responses.push(...batchResult.responses);
    }

    this.logger.log(
      `[EXPO_PUSH] tokens=${tokens.length} success=${result.successCount} failures=${result.failureCount}`,
    );

    return result;
  }

  private async sendBatch(tokens: string[], firebaseData: BaseMessage): Promise<ExpoPushResult> {
    const messages = tokens.map((to) => this.buildMessage(to, firebaseData));

    let tickets: ExpoTicket[];
    try {
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Expo Push API respondió ${response.status}: ${text}`);
      }

      const payload = (await response.json()) as { data?: ExpoTicket[] };
      tickets = payload.data ?? [];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[EXPO_PUSH] ❌ batch de ${tokens.length} token(s) falló: ${message}`);
      return {
        successCount: 0,
        failureCount: tokens.length,
        responses: tokens.map(() => ({ success: false, error: message })),
      };
    }

    const responses: ExpoPushResponse[] = tokens.map((token, index) => {
      // Expo devuelve los tickets en el mismo orden que los mensajes enviados.
      const ticket = tickets[index];

      if (!ticket) {
        return { success: false, error: 'Expo Push API no devolvió ticket para este token' };
      }

      if (ticket.status === 'error') {
        this.logger.warn(
          `[EXPO_PUSH] ticket error token=${token.slice(0, 30)}... message=${ticket.message ?? '-'} error=${ticket.details?.error ?? '-'}`,
        );
        return { success: false, error: ticket.message, errorCode: ticket.details?.error };
      }

      return { success: true, messageId: ticket.id };
    });

    const successCount = responses.filter((r) => r.success).length;

    return {
      successCount,
      failureCount: responses.length - successCount,
      responses,
    };
  }

  /**
   * Traduce el `firebaseData` (con forma de mensaje de Firebase) al formato de
   * la Expo Push API. Los bloques `android`/`apns` no se reenvían: son
   * específicos de Firebase y Expo los ignora; solo se rescata el `channelId`.
   */
  private buildMessage(to: string, firebaseData: BaseMessage) {
    const notification = firebaseData.notification;
    const channelId =
      (firebaseData.android?.notification?.channelId as string | undefined) ??
      (firebaseData.android?.channelId as string | undefined);

    return {
      to,
      title: notification?.title,
      body: notification?.body,
      data: firebaseData.data ?? {},
      sound: 'default',
      priority: 'high' as const,
      ...(notification?.imageUrl ? { richContent: { image: notification.imageUrl } } : {}),
      ...(channelId ? { channelId } : {}),
    };
  }
}
