import { Expo, ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo();

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

export async function sendPushNotification(
  tokens: string[],
  payload: PushNotificationPayload
): Promise<void> {
  const messages: ExpoPushMessage[] = [];

  for (const pushToken of tokens) {
    if (!Expo.isExpoPushToken(pushToken)) {
      console.error(`[PushService] Push token ${pushToken} is not a valid Expo push token`);
      continue;
    }

    messages.push({
      to: pushToken,
      sound: "default",
      title: payload.title,
      body: payload.body,
      data: payload.data,
    });
  }

  const chunks = expo.chunkPushNotifications(messages);
  
  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      console.log("[PushService] Sent chunk of notifications:", ticketChunk);
    } catch (error) {
      console.error("[PushService] Error sending chunk:", error);
    }
  }
}
