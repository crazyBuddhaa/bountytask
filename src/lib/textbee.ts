import axios from "axios"

/**
 * TextBee (textbee.dev) — sends SMS through a linked Android device's own
 * SIM/carrier plan rather than a billed cloud SMS API. Free to use, but
 * delivery depends on that device staying online with the TextBee app
 * running. Configure TEXTBEE_API_KEY and TEXTBEE_DEVICE_ID as env vars on
 * the hosting platform (never a Replit secret — this app is external).
 */
export async function sendSms(phone: string, message: string): Promise<void> {
  const apiKey = process.env.TEXTBEE_API_KEY
  const deviceId = process.env.TEXTBEE_DEVICE_ID

  if (!apiKey || !deviceId) {
    throw new Error("SMS is not configured. Set TEXTBEE_API_KEY and TEXTBEE_DEVICE_ID.")
  }

  try {
    await axios.post(
      `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`,
      { recipients: [phone], message },
      { headers: { "Content-Type": "application/json", "x-api-key": apiKey }, timeout: 15_000 }
    )
  } catch (e) {
    const detail = axios.isAxiosError(e) ? e.response?.data?.message ?? e.message : (e as Error).message
    throw new Error(`Failed to send SMS: ${detail}`)
  }
}
