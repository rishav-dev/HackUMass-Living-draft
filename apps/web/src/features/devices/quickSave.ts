import type {
  CaptureAnalysisDto,
  CaptureContextDto,
  MemoryCardDto,
  MemoryDetailDto,
  ProfileDto,
} from '@living-draft/contracts';
import { toThirdPerson } from '@living-draft/engine';
import { api } from '../../api/client';

export async function quickSave(
  text: string,
  context?: CaptureContextDto,
): Promise<MemoryDetailDto> {
  const analysis = await api.post<CaptureAnalysisDto>('/memories/analyze', {
    text,
    kind: 'memory',
  });
  return api.post<MemoryDetailDto>('/memories', {
    title: analysis.title,
    originalText: text,
    readingCopy: analysis.readingCopy,
    sourceKind: 'speech',
    context,
    temporal: { ...analysis.temporal, confirmed: false },
    people: analysis.people.map((p) => ({
      label: p.suggestion?.name ?? p.label,
      surfaces: p.surfaces,
      characterId: p.suggestion?.characterId ?? null,
      relationship: p.relationship,
      role: p.role,
      roleEvidence: p.roleEvidence,
      addAlias: true,
    })),
    emotions: analysis.emotions.map((e) => ({
      tag: e.tag,
      phase: e.phase,
      source: 'suggested',
      evidence: e.quote,
    })),
  });
}

export async function memoryToRead(): Promise<MemoryCardDto | null> {
  const cards = (await api.get<MemoryCardDto[]>('/memories')).filter((m) => !m.sensitive);
  if (!cards.length) return null;
  const today = new Date();
  const onThisDay = cards.find(
    (m) => m.temporal.month === today.getMonth() + 1 && m.temporal.day === today.getDate(),
  );
  return onThisDay ?? cards[Math.floor(Math.random() * cards.length)]!;
}

export async function readable(
  memory: MemoryCardDto,
  profile: ProfileDto | null | undefined,
): Promise<string> {
  const detail = await api.get<MemoryDetailDto>(`/memories/${memory.id}`);
  const body =
    profile?.narrativeVoice === 'third'
      ? toThirdPerson(detail.readingCopy, {
          name: profile.preferredName,
          pronouns: profile.pronouns,
        })
      : detail.readingCopy;
  return `${detail.title}. ${detail.temporal.label}. ${body}`;
}
