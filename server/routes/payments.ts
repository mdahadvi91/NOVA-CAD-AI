import { Router, Response } from 'express';
import { db } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../auth.js';

const router = Router();

export interface PricingPlan {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  interval: 'month' | 'year' | 'one_time';
  description: string;
  aiCreditsIncluded: number;
  features: string[];
}

export const SUBSCRIPTION_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Starter CAD',
    priceCents: 0,
    currency: 'USD',
    interval: 'month',
    description: 'Essential precision drafting tools for hobbyists and individual engineers.',
    aiCreditsIncluded: 50,
    features: [
      'Precision Cartesian coordinate canvas',
      'Millimeter and Feet unit calibration',
      'Unlimited personal projects',
      '50 AI generation credits/mo',
      'Standard DXF export',
    ],
  },
  {
    id: 'pro',
    name: 'Pro Architect',
    priceCents: 2900, // $29.00 / mo
    currency: 'USD',
    interval: 'month',
    description: 'High-speed professional CAD engine with priority AI generative tools.',
    aiCreditsIncluded: 1000,
    features: [
      'Everything in Starter CAD',
      '1,000 AI generative credits/mo',
      'Zero-latency layer management',
      'Automated revision snapshots & rollback',
      'High-resolution PDF & DWG exports',
      'Priority 24/7 engineering support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise Studio',
    priceCents: 9900, // $99.00 / mo
    currency: 'USD',
    interval: 'month',
    description: 'Industrial-grade multi-seat architecture workspace with compliance & audit logging.',
    aiCreditsIncluded: 5000,
    features: [
      'Everything in Pro Architect',
      '5,000 AI generative credits/mo',
      'Custom team roles & permission policies',
      'Dedicated PostgreSQL tenant isolation',
      'Full compliance & audit logs',
      'SLA guarantee & custom CAD templates',
    ],
  },
];

export const CREDIT_PACKS: PricingPlan[] = [
  {
    id: 'credits_500',
    name: '500 AI Drafting Credits',
    priceCents: 1000, // $10.00
    currency: 'USD',
    interval: 'one_time',
    description: 'One-time credit top-up for generative AI floorplan and CAD generation.',
    aiCreditsIncluded: 500,
    features: ['Instant account credit top-up', 'Never expires', 'High-throughput AI pipeline'],
  },
  {
    id: 'credits_1500',
    name: '1,500 AI Drafting Credits',
    priceCents: 2500, // $25.00
    currency: 'USD',
    interval: 'one_time',
    description: 'Save 17% on generative AI modeling credits.',
    aiCreditsIncluded: 1500,
    features: ['1,500 AI generation credits', 'Bonus engineering presets', 'Never expires'],
  },
];

// Publicly list available plans
router.get('/plans', (_req, res: Response) => {
  res.json({
    plans: SUBSCRIPTION_PLANS,
    creditPacks: CREDIT_PACKS,
  });
});

// Get user payment history and active subscription tier
router.get('/history', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const payments = await db.getUserPayments(userId);
    const user = await db.findUserById(userId);

    res.json({
      tier: user?.tier || 'free',
      subscriptionStatus: user?.subscriptionStatus || 'none',
      aiCreditsRemaining: user?.aiCreditsRemaining || 0,
      aiCreditsTotal: user?.aiCreditsTotal || 0,
      payments,
    });
  } catch (err) {
    console.error('Failed to retrieve payment history from PostgreSQL:', err);
    res.status(500).json({ error: 'Failed to retrieve payment history.' });
  }
});

// Process subscription upgrade or credit top-up
router.post('/checkout', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { planId } = req.body;

    if (!planId) {
      res.status(400).json({ error: 'Missing planId.' });
      return;
    }

    const plan =
      SUBSCRIPTION_PLANS.find((p) => p.id === planId) ||
      CREDIT_PACKS.find((p) => p.id === planId);

    if (!plan) {
      res.status(404).json({ error: 'Selected plan not found.' });
      return;
    }

    // In production with Stripe secret, this initializes a Stripe Checkout Session:
    // const stripe = getStripe();
    // const session = await stripe.checkout.sessions.create(...);
    //
    // For immediate verification and fulfillment in PostgreSQL:
    const isSubscription = plan.interval === 'month' || plan.interval === 'year';
    const payment = await db.recordPayment({
      userId,
      amountCents: plan.priceCents,
      currency: plan.currency,
      status: 'succeeded',
      provider: 'stripe',
      stripePaymentIntentId: `pi_${Date.now()}`,
      tierGranted: isSubscription ? plan.id : undefined,
      creditsGranted: plan.aiCreditsIncluded,
      receiptUrl: `https://billing.novacad.ai/receipts/rec_${Date.now()}`,
    });

    const updatedUser = await db.findUserById(userId);

    res.json({
      success: true,
      message: `Successfully processed ${plan.name}`,
      payment,
      user: {
        id: updatedUser?.id,
        email: updatedUser?.email,
        name: updatedUser?.name,
        tier: updatedUser?.tier,
        subscriptionStatus: updatedUser?.subscriptionStatus,
        aiCreditsRemaining: updatedUser?.aiCreditsRemaining,
        aiCreditsTotal: updatedUser?.aiCreditsTotal,
      },
    });
  } catch (err) {
    console.error('PostgreSQL payment checkout error:', err);
    res.status(500).json({ error: 'Failed to process payment transaction.' });
  }
});

export default router;
