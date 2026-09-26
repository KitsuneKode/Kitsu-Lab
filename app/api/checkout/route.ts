import { createCheckout, dodoEnvironment } from '@/lib/dodo'
import { findPlan } from '@/lib/pro-plans'
import { SITE_URL } from '@/lib/site'

/**
 * Sends the buyer to Dodo's hosted checkout for one plan. A plain form
 * posts here, so the pricing page needs no client JavaScript, and a GET
 * (a link crawler, a prefetch) never creates a checkout.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null)
  const plan = findPlan(form?.get('plan'))
  const apiKey = process.env.DODO_PAYMENTS_API_KEY
  const productId = plan ? process.env[plan.productEnv] : undefined
  if (!plan || !apiKey || !productId)
    return Response.redirect(`${SITE_URL}/pro?checkout=unavailable`, 303)

  try {
    const url = await createCheckout({
      productId,
      apiKey,
      environment: dodoEnvironment(process.env.DODO_PAYMENTS_ENVIRONMENT),
      returnUrl: `${SITE_URL}/pro/thanks?plan=${plan.id}`,
      metadata: { plan: plan.id },
    })
    return Response.redirect(url, 303)
  } catch {
    return Response.redirect(`${SITE_URL}/pro?checkout=error`, 303)
  }
}
