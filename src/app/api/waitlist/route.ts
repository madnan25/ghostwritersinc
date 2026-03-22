import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_DEVICES = new Set(['mobile', 'desktop']);

export async function POST(req: NextRequest) {
  // Rate limit: 5 requests per IP per hour
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  const limited = await rateLimit(`waitlist:${ip}`, {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const { email, device } = await req.json();

  // Validate email
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  // Validate and sanitize device
  const sanitizedDevice =
    typeof device === 'string' && ALLOWED_DEVICES.has(device)
      ? device
      : 'unknown';

  // Generate timestamp server-side in PKT
  const timestamp = new Date().toLocaleString('en-PK', {
    timeZone: 'Asia/Karachi',
  });

  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('GOOGLE_SHEETS_WEBHOOK_URL is not configured');
    return NextResponse.json(
      { error: 'Waitlist temporarily unavailable' },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        device: sanitizedDevice,
        timestamp,
      }),
    });

    if (!res.ok) {
      console.error('Google Sheets webhook error:', res.status);
      return NextResponse.json(
        { error: 'Failed to register' },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Waitlist submission error:', err);
    return NextResponse.json(
      { error: 'Failed to register' },
      { status: 502 },
    );
  }
}
