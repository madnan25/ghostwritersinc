import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { email, device, timestamp } = await req.json();

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

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
      body: JSON.stringify({ email, device, timestamp }),
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
