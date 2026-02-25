/**
 * Committee summary generation using LLM
 */

import { chatCompletion, CompletionOptions } from './openrouter';
import { Event } from '@/lib/db/schema';

const SYSTEM_PROMPT = `You are a helpful assistant that summarizes city government committee activity for citizens. 
Your summaries should be:
- Clear and accessible to general audiences (avoid jargon)
- Factual and based only on the information provided
- Focused on what matters to residents
- Concise but informative (2-3 short paragraphs)

Format your response as plain text paragraphs. Do not use markdown headers or bullet points.`;

/**
 * Generate a summary of recent committee activity
 */
export async function generateCommitteeSummary(
  committeeName: string,
  recentMeetings: Event[],
  options?: CompletionOptions
): Promise<{ summary: string; model: string }> {
  if (recentMeetings.length === 0) {
    return {
      summary: `No recent meetings found for ${committeeName}. Check back later for updates on upcoming sessions.`,
      model: 'none',
    };
  }

  // Build context from recent meetings
  const meetingContext = recentMeetings
    .slice(0, 10) // Limit to 10 most recent
    .map((meeting, i) => {
      const date = new Date(meeting.startDateTime).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      
      let info = `Meeting ${i + 1}: ${meeting.eventName} on ${date}`;
      
      if (meeting.eventDescription) {
        info += `\nDescription: ${meeting.eventDescription}`;
      }
      
      if (meeting.agendaName) {
        info += `\nAgenda: ${meeting.agendaName}`;
      }
      
      if (meeting.fileNames) {
        info += `\nDocuments: ${meeting.fileNames}`;
      }
      
      return info;
    })
    .join('\n\n');

  const userPrompt = `Please provide a brief summary of recent activity for the "${committeeName}" committee based on these recent meetings:

${meetingContext}

Summarize the key topics, decisions, or upcoming business that residents should know about. Focus on what's most relevant to the community.`;

  const result = await chatCompletion(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    {
      temperature: 0.5, // Lower temperature for more factual output
      maxTokens: 512,
      ...options,
    }
  );

  return {
    summary: result.content,
    model: result.model,
  };
}
