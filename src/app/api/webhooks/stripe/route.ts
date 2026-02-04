import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/supabase/server'
import { getPlanByPriceId } from '@/lib/stripe/plans'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          )

          const priceId = subscription.items.data[0]?.price.id
          const plan = getPlanByPriceId(priceId)

          if (plan && session.client_reference_id) {
            await supabase
              .from('profiles')
              .update({
                plan: plan.id,
                stripe_customer_id: session.customer as string,
                stripe_subscription_id: subscription.id,
                monthly_quota: plan.quota,
              })
              .eq('id', session.client_reference_id)

            // Track event
            await supabase.from('events').insert({
              user_id: session.client_reference_id,
              event_type: 'subscription_created',
              metadata: {
                plan: plan.id,
                price: plan.price,
                subscription_id: subscription.id,
              },
            })
          }
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const priceId = subscription.items.data[0]?.price.id
        const plan = getPlanByPriceId(priceId)

        if (plan) {
          // Find user by stripe_subscription_id
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_subscription_id', subscription.id)
            .single()

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const profileId = (profile as any)?.id

          if (profileId) {
            await supabase
              .from('profiles')
              .update({
                plan: plan.id,
                monthly_quota: plan.quota,
              })
              .eq('id', profileId)

            await supabase.from('events').insert({
              user_id: profileId,
              event_type: 'subscription_updated',
              metadata: {
                plan: plan.id,
                status: subscription.status,
              },
            })
          }
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        // Find user by stripe_subscription_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_subscription_id', subscription.id)
          .single()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const profileId = (profile as any)?.id

        if (profileId) {
          await supabase
            .from('profiles')
            .update({
              plan: 'free',
              stripe_subscription_id: null,
              monthly_quota: 5,
            })
            .eq('id', profileId)

          await supabase.from('events').insert({
            user_id: profileId,
            event_type: 'subscription_cancelled',
            metadata: {
              previous_subscription_id: subscription.id,
            },
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }

        if (invoice.subscription) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_subscription_id', invoice.subscription as string)
            .single()

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const profileId = (profile as any)?.id

          if (profileId) {
            await supabase.from('events').insert({
              user_id: profileId,
              event_type: 'payment_failed',
              metadata: {
                invoice_id: invoice.id,
                amount: invoice.amount_due,
              },
            })
          }
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
