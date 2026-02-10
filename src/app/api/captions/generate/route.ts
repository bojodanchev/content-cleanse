import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const STYLES: Record<string, string> = {
  mixed:
    'Use ALL of the viral caption patterns below, varying randomly across captions.',
  drama:
    'Focus on relationship drama, shocking confessions, and first-person scandalous stories.',
  listicle: "Focus on 'top N' lists, rankings, and numbered hooks.",
  hottake:
    'Focus on controversial, relatable, and divisive opinions and hot takes.',
  cliffhanger:
    "Focus on incomplete sentences, curiosity gaps, and '...' endings that make people need to see more.",
}

const SYSTEM_PROMPT = `You are a viral social media caption writer for TikTok, Instagram Reels, and YouTube Shorts. \
You write captions that get 100K-1M+ views.

NICHE: {niche}
STYLE FOCUS: {style_instruction}

VIRAL CAPTION PATTERNS you must use:

1. CURIOSITY GAPS — mysterious, vague statements that force someone to watch.
   Examples: "no one understands what happens when no one is watching..."
   "you won't believe what she said after this..."

2. RELATIONSHIP DRAMA — shocking boyfriend/girlfriend/ex stories.
   Examples: "my boyfriend of 3 years broke up with me after 2 doctors..."
   "i caught my man texting his ex and what she sent back..."

3. CLIFFHANGERS WITH "..." — sentences that cut off at the most interesting part.
   Examples: "if your man ever says these..."
   "top 5 things that squirt..."

4. TOP N LISTICLES — ranked lists that promise value.
   Examples: "top 5 waterparks to take your friends to"
   "3 things every girl should know before 25"

5. PROFESSION/IDENTITY HOOKS — job or identity reveal that creates shock.
   Examples: "men refuse to eat my food when they find out i work as a..."
   "people treat me different when they find out im actually a..."

6. RELATABLE HOT TAKES — opinions everyone secretly agrees with.
   Examples: "marriage is scary bcus what if he doesn't like the floor plan?"
   "being an adult is just googling how to do stuff"

7. PROVOCATIVE CONFESSIONS — first-person shocking admissions.
   Examples: "i haven't told anyone this but..."
   "ngl i did something crazy last night..."

8. BACKWARDS TEXT PUZZLES — scrambled or reversed text for engagement bait.
   Examples: "if you can read this backwards you're built different"

9. "ME SINGLE VS..." — comparison hooks showing contrasts.
   Examples: "me single vs me in a relationship"
   "what i ordered vs what i got"

10. INCOMPLETE SENTENCES — sentences missing a key word that makes people watch.
    Examples: "she really just _____ in front of everyone"
    "i can't believe he actually..."

RULES — follow these strictly:
- UNDER 20 words per caption, max 30 absolute limit
- Casual lowercase tone — use abbreviations like "bcus", "tbh", "ngl", "imo", "rn", "lowkey"
- Sparse emoji — 0 to 2 max per caption, most captions should have zero
- Must sound like a REAL PERSON typed it, NOT like AI or a brand
- Each caption must be DIFFERENT — vary the pattern used
- Written in first person
- Use "..." for cliffhangers and suspense
- Adapt every caption to the niche: {niche}
- No hashtags, no @mentions, no links
- No quotation marks around the captions

OUTPUT FORMAT:
Return ONLY the captions, one per line. No numbering, no bullets, no extra text.`

const BATCH_SIZE = 50
const MAX_CAPTIONS = 50
const VALID_STYLES = Object.keys(STYLES)

export async function POST(request: Request) {
  try {
    // Support both JSON and FormData (frontend sends FormData when including an image)
    let niche: string | undefined
    let count: number | undefined
    let style: string = 'mixed'
    let imageBase64: string | undefined

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      niche = formData.get('niche') as string | undefined
      count = parseInt(formData.get('count') as string) || undefined
      style = (formData.get('style') as string) || 'mixed'

      const imageFile = formData.get('image') as File | null
      if (imageFile) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
        if (!allowedTypes.includes(imageFile.type)) {
          return NextResponse.json({ error: 'Invalid image type. Use JPG, PNG, or WebP.' }, { status: 400 })
        }
        const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB
        if (imageFile.size > MAX_IMAGE_SIZE) {
          return NextResponse.json({ error: 'Image exceeds 10MB size limit.' }, { status: 400 })
        }
        const buffer = await imageFile.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        imageBase64 = `data:${imageFile.type};base64,${base64}`
      }
    } else {
      const body = await request.json()
      niche = body.niche
      count = body.count
      style = body.style || 'mixed'
    }

    // Validate required fields
    if (!niche || typeof niche !== 'string' || niche.trim().length === 0) {
      return NextResponse.json(
        { error: 'Niche is required' },
        { status: 400 }
      )
    }

    if (!count || typeof count !== 'number' || count < 1) {
      return NextResponse.json(
        { error: 'Count must be at least 1' },
        { status: 400 }
      )
    }

    if (count > MAX_CAPTIONS) {
      return NextResponse.json(
        { error: `Count cannot exceed ${MAX_CAPTIONS}` },
        { status: 400 }
      )
    }

    if (!VALID_STYLES.includes(style)) {
      return NextResponse.json(
        { error: `Invalid style. Choose from: ${VALID_STYLES.join(', ')}` },
        { status: 400 }
      )
    }

    // Verify the user is authenticated
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error('OPENAI_API_KEY not configured')
      return NextResponse.json(
        { error: 'AI caption generation is not configured' },
        { status: 500 }
      )
    }

    const client = new OpenAI({ apiKey })
    const styleInstruction = STYLES[style]
    const systemMsg = SYSTEM_PROMPT.replace(/\{niche\}/g, niche.trim()).replace(
      '{style_instruction}',
      styleInstruction
    )

    const allCaptions: string[] = []
    const batches = Math.ceil(count / BATCH_SIZE)

    for (let batchIdx = 0; batchIdx < batches; batchIdx++) {
      const remaining = count - allCaptions.length
      const batchCount = Math.min(BATCH_SIZE, remaining)

      let userMsg = `Generate exactly ${batchCount} viral captions for the ${niche.trim()} niche. One per line.`
      if (batchIdx > 0) {
        userMsg += ' Make them completely different from previous batches.'
      }

      // Build messages array
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemMsg },
      ]

      // If image is provided, use vision mode for image-aware captions
      if (imageBase64 && batchIdx === 0) {
        messages.push({
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Look at this photo and ${userMsg} Make the captions relevant to what you see in the image.`,
            },
            {
              type: 'image_url',
              image_url: { url: imageBase64 },
            },
          ],
        })
      } else {
        messages.push({ role: 'user', content: userMsg })
      }

      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 1.0,
        max_tokens: 2048,
      })

      const text = response.choices[0]?.message?.content || ''
      const lines = text
        .trim()
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)

      allCaptions.push(...lines)
    }

    // Trim to exact count requested
    const captions = allCaptions.slice(0, count)

    return NextResponse.json({ captions })
  } catch (error) {
    console.error('Caption generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate captions' },
      { status: 500 }
    )
  }
}
