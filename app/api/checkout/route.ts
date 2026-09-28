import { createCheckout, dodoEnvironment } from '@/lib/dodo'
import { findPlan } from '@/lib/pro-plans'

/**
 * Sends the buyer to Dodo's hosted checkout for one plan. A plain form
 * posts here, so the pricing page needs no client JavaScript, and a GET
 * (a link crawler, a prefetch) never creates a checkout.
 */
export async function POST(request: Request) {
  // The origin the buyer came from, so previews and local runs return there.
  const origin = new URL(request.url).origin
  const form = await request.formData().catch(() => null)
  const plan = findPlan(form?.get('plan'))
  const apiKey = process.env.DODO_PAYMENTS_API_KEY
  const productId = plan ? process.env[plan.productEnv] : undefined
  if (!plan || !apiKey || !productId)
    return Response.redirect(`${origin}/pro?checkout=unavailable`, 303)

  try {
    const url = await createCheckout({
      productId,
      apiKey,
      environment: dodoEnvironment(process.env.DODO_PAYMENTS_ENVIRONMENT),
      returnUrl: `${origin}/pro/thanks?plan=${plan.id}`,
      metadata: { plan: plan.id },
    })
    return Response.redirect(url, 303)
  } catch {
    return Response.redirect(`${origin}/pro?checkout=error`, 303)
  }
}
