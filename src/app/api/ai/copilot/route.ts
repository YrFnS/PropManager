import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { strictRateLimit, sanitizeString } from '@/lib/validation';
import ZAI from 'z-ai-web-dev-sdk';
import { moneyToNumber } from '@/lib/money';

export async function POST(req: NextRequest) {
  try {
    const rateLimitResult = strictRateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { message } = await req.json();

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ response: 'Please enter a question.' }, { status: 400 });
    }

    // Sanitize user input
    const sanitizedMessage = sanitizeString(message, 2000);

    // Gather context from the database for the AI
    const properties = await db.property.findMany({ include: { units: true, manager: true } });
    const tenants = await db.tenant.findMany({ include: { leases: true } });
    const activeLeases = await db.lease.findMany({
      where: { status: 'active' },
      include: { unit: { include: { property: true } }, tenant: true },
    });
    const payments = await db.payment.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: { tenant: true, lease: { include: { unit: { include: { property: true } } } } },
    });
    const maintenanceRequests = await db.maintenanceRequest.findMany({
      include: { property: true, unit: true, tenant: true },
    });

    // Stats summary
    const totalProperties = properties.length;
    const totalUnits = properties.reduce((sum, p) => sum + p.units.length, 0);
    const occupiedUnits = properties.reduce(
      (sum, p) => sum + p.units.filter((u) => u.status === 'rented').length,
      0,
    );
    const occupancyRate = totalUnits > 0 ? ((occupiedUnits / totalUnits) * 100).toFixed(1) : '0';
    const totalRevenue = activeLeases.reduce((sum, l) => sum + moneyToNumber(l.rentAmount), 0);
    const pendingPayments = await db.payment.count({ where: { status: 'pending' } });
    const latePayments = await db.payment.count({ where: { status: 'late' } });
    const openMaintenance = await db.maintenanceRequest.count({
      where: { status: { in: ['open', 'in_progress'] } },
    });

    // Build context for AI
    const context = `You are an AI property management assistant for PropManager. You help property managers with insights, recommendations, and answers about their portfolio.

Current Portfolio Summary:
- ${totalProperties} properties with ${totalUnits} total units
- Occupancy rate: ${occupancyRate}%
- Monthly revenue from active leases: $${totalRevenue.toLocaleString()}
- Pending payments: ${pendingPayments}
- Late payments: ${latePayments}
- Open/In-progress maintenance requests: ${openMaintenance}

Properties:
${properties.map((p) => `- ${p.name} (${p.type}, ${p.units.length} units, ${p.address})`).join('\n')}

Active Leases:
${activeLeases
  .slice(0, 10)
  .map(
    (l) =>
      `- ${l.tenant.name} in ${l.unit.unitNumber} at ${l.unit.property.name}: $${moneyToNumber(l.rentAmount).toLocaleString()}/month, ends ${l.endDate.toISOString().split('T')[0]}`,
  )
  .join('\n')}

Recent Payments:
${payments
  .slice(0, 10)
  .map((p) => `- ${p.tenant.name}: $${moneyToNumber(p.amount).toLocaleString()} (${p.status})`)
  .join('\n')}

Open Maintenance:
${maintenanceRequests
  .filter((m) => m.status === 'open' || m.status === 'in_progress')
  .slice(0, 10)
  .map((m) => `- [${m.priority}] ${m.title} at ${m.property.name} (${m.status})`)
  .join('\n')}

Answer the user's question based on this data. Be helpful, concise, and provide actionable insights when relevant. If they ask about something not in the data, provide general property management advice. Always format numbers with commas and $ for currency.`;

    // Call LLM via z-ai-web-dev-sdk
    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: context },
        { role: 'user', content: sanitizedMessage },
      ],
      thinking: { type: 'disabled' },
    });

    const aiResponse =
      completion.choices[0]?.message?.content ||
      'I apologize, I could not process your request. Please try again.';

    return NextResponse.json({ response: aiResponse });
  } catch (error: unknown) {
    console.error('AI Copilot error:', error);
    // Don't leak stack traces in production
    return NextResponse.json(
      { response: 'Sorry, I encountered an error processing your request. Please try again.' },
      { status: 500 },
    );
  }
}
