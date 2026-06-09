import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'thisMonth';

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (period) {
      case 'lastMonth': {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        startDate = lastMonth;
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      }
      case 'thisQuarter': {
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        startDate = quarterStart;
        endDate = now;
        break;
      }
      case 'thisYear': {
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = now;
        break;
      }
      default: { // thisMonth
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now;
        break;
      }
    }

    // Get payments within the date range
    const payments = await db.payment.findMany({
      where: {
        dueDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        tenant: { select: { id: true, name: true, nameAr: true } },
        lease: {
          include: {
            unit: {
              include: { property: { select: { id: true, name: true, nameAr: true } } },
            },
          },
        },
      },
      orderBy: { dueDate: 'desc' },
    });

    // Summary calculations
    const totalRevenue = payments
      .filter((p) => p.status === 'paid' || p.status === 'partial')
      .reduce((sum, p) => sum + p.amount, 0);

    const totalExpected = payments.reduce((sum, p) => sum + p.amount, 0);

    const collectionRate = totalExpected > 0
      ? Math.round((totalRevenue / totalExpected) * 100)
      : 0;

    const outstandingAmount = payments
      .filter((p) => p.status === 'pending' || p.status === 'late')
      .reduce((sum, p) => sum + p.amount, 0);

    // Monthly Revenue Trend (last 12 months)
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const allPayments12Months = await db.payment.findMany({
      where: {
        status: { in: ['paid', 'partial'] },
        paidDate: { gte: twelveMonthsAgo },
      },
      select: { amount: true, paidDate: true },
    });

    const monthlyRevenue: { month: string; revenue: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = monthDate.toISOString().slice(0, 7); // YYYY-MM
      const monthRevenue = allPayments12Months
        .filter((p) => {
          if (!p.paidDate) return false;
          const paidMonth = p.paidDate.toISOString().slice(0, 7);
          return paidMonth === monthKey;
        })
        .reduce((sum, p) => sum + p.amount, 0);
      monthlyRevenue.push({ month: monthKey, revenue: monthRevenue });
    }

    // Revenue by Property
    const properties = await db.property.findMany({
      include: {
        units: {
          include: {
            lease: {
              where: { status: 'active' },
              select: { rentAmount: true },
            },
          },
        },
      },
    });

    const revenueByProperty = properties.map((p) => {
      const revenue = p.units.reduce((sum, u) => {
        const leaseRent = u.lease?.rentAmount || u.rentAmount;
        return sum + leaseRent;
      }, 0);
      return {
        name: p.name,
        nameAr: p.nameAr,
        revenue,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    // Payment Methods Breakdown
    const methodCounts: Record<string, { count: number; amount: number }> = {};
    payments
      .filter((p) => p.status === 'paid' || p.status === 'partial')
      .forEach((p) => {
        const method = p.method || 'other';
        if (!methodCounts[method]) {
          methodCounts[method] = { count: 0, amount: 0 };
        }
        methodCounts[method].count++;
        methodCounts[method].amount += p.amount;
      });

    const paymentMethods = Object.entries(methodCounts).map(([method, data]) => ({
      method,
      count: data.count,
      amount: data.amount,
    }));

    // If no payment methods data, provide default structure
    if (paymentMethods.length === 0) {
      ['cash', 'bank_transfer', 'online', 'check'].forEach((m) => {
        paymentMethods.push({ method: m, count: 0, amount: 0 });
      });
    }

    // Top Tenants by total paid
    const tenantTotals: Record<string, { id: string; name: string; nameAr: string | null; totalPaid: number; paymentCount: number }> = {};
    payments
      .filter((p) => p.status === 'paid' || p.status === 'partial')
      .forEach((p) => {
        const tid = p.tenantId;
        if (!tenantTotals[tid]) {
          tenantTotals[tid] = {
            id: tid,
            name: p.tenant.name,
            nameAr: p.tenant.nameAr,
            totalPaid: 0,
            paymentCount: 0,
          };
        }
        tenantTotals[tid].totalPaid += p.amount;
        tenantTotals[tid].paymentCount++;
      });

    const topTenants = Object.values(tenantTotals)
      .sort((a, b) => b.totalPaid - a.totalPaid)
      .slice(0, 10);

    return NextResponse.json({
      summary: {
        totalRevenue,
        totalExpected,
        collectionRate,
        outstandingAmount,
      },
      monthlyRevenue,
      revenueByProperty,
      paymentMethods,
      topTenants,
    });
  } catch (error) {
    console.error('Reports API error:', error);
    return NextResponse.json({ error: 'Failed to generate reports' }, { status: 500 });
  }
}
