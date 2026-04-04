import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, meetingVideos, meetingTranscripts } from '@/lib/db';
import { chatCompletion, type ChatMessage } from '@/lib/llm/openrouter';
import { SMART_MODEL } from '@/lib/llm/models';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: 'Chat is not configured (missing OPENROUTER_API_KEY)' },
      { status: 503 },
    );
  }

  const { id } = await params;
  const eventId = parseInt(id);
  if (isNaN(eventId)) {
    return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
  }

  let body: { messages?: { role: string; content: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const messages = body.messages ?? [];
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const query = (lastUser?.content ?? '').trim();
  if (!query) {
    return NextResponse.json({ error: 'No user message to answer' }, { status: 400 });
  }

  try {
    const videos = await db
      .select()
      .from(meetingVideos)
      .where(eq(meetingVideos.eventId, eventId))
      .limit(1);

    if (videos.length === 0) {
      return NextResponse.json({ error: 'No video for this meeting' }, { status: 404 });
    }

    const transcripts = await db
      .select({
        cleanedTranscript: meetingTranscripts.cleanedTranscript,
        summaryJson: meetingTranscripts.summaryJson,
        topicsJson: meetingTranscripts.topicsJson,
        speakersJson: meetingTranscripts.speakersJson,
      })
      .from(meetingTranscripts)
      .where(eq(meetingTranscripts.videoId, videos[0].id))
      .limit(1);

    const transcript = transcripts[0];
    if (!transcript?.cleanedTranscript) {
      return NextResponse.json({ error: 'No transcript text available' }, { status: 422 });
    }

    let preamble = '';

    if (transcript.summaryJson) {
      try {
        const summary = JSON.parse(transcript.summaryJson);
        const parts: string[] = [];
        if (summary.executiveSummary) parts.push(`Executive Summary: ${summary.executiveSummary}`);
        if (summary.keyDecisions?.length) parts.push(`Key Decisions:\n- ${summary.keyDecisions.join('\n- ')}`);
        if (summary.motionsAndVotes?.length) parts.push(`Motions & Votes:\n- ${summary.motionsAndVotes.join('\n- ')}`);
        if (summary.actionItems?.length) parts.push(`Action Items:\n- ${summary.actionItems.join('\n- ')}`);
        if (summary.publicCommentsSummary) parts.push(`Public Comments Summary: ${summary.publicCommentsSummary}`);
        if (parts.length) preamble += `MEETING OVERVIEW:\n${parts.join('\n\n')}\n\n`;
      } catch { /* ignore malformed JSON */ }
    }

    if (transcript.topicsJson) {
      try {
        const topics = JSON.parse(transcript.topicsJson) as { topic: string; keywords: string[] }[];
        if (topics.length) {
          preamble += `TOPICS DISCUSSED: ${topics.map((t) => t.topic).join(', ')}\n\n`;
        }
      } catch { /* ignore */ }
    }

    const systemContent =
      `You are a helpful assistant answering questions about a city government meeting based on its transcript. ` +
      `Answer based only on the information in the transcript. If the answer is not in the transcript, say so. ` +
      `Do not make up information. When relevant, cite specific quotes or speakers.\n\n` +
      (preamble ? `${preamble}---\n\n` : '') +
      `FULL TRANSCRIPT:\n\n${transcript.cleanedTranscript}`;

    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemContent },
      ...messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
    ];

    const { content, model } = await chatCompletion(chatMessages, {
      model: SMART_MODEL,
      temperature: 0.3,
      maxTokens: 1024,
    });

    return NextResponse.json({ content, model });
  } catch (e) {
    console.error(`Transcript chat error (event ${eventId}):`, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Chat failed' },
      { status: 500 },
    );
  }
}
