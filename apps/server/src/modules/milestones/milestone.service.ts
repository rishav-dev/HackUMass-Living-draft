import type { MilestoneDto, MilestoneInput } from '@living-draft/contracts';
import { ageOnDate } from '@living-draft/engine';
import { all, get, run, transaction } from '../../db/database';
import { newId, notFound, now } from '../../lib/http';
import type { MilestoneRow } from '../archive/rows';
import { findProfile } from '../profile/profile.repository';

function toDto(row: MilestoneRow): MilestoneDto {
  return {
    id: row.id,
    title: row.title,
    ageMin: row.age_min,
    ageMax: row.age_max,
    year: row.year,
    date: row.date,
    description: row.description,
    memoryIds: all<{ memory_id: string }>(
      'SELECT memory_id FROM milestone_memories WHERE milestone_id = ?',
      row.id,
    ).map((r) => r.memory_id),
  };
}

export function listMilestones(): MilestoneDto[] {
  return all<MilestoneRow>(
    "SELECT * FROM milestones ORDER BY COALESCE(age_min, 999), COALESCE(date, ''), title",
  ).map(toDto);
}

function placement(input: MilestoneInput) {
  const date = input.date ?? null;
  const profile = findProfile();
  const birth = profile?.birthDate;
  if (date && !birth && profile) {
    const age = profile.currentAge - (new Date().getFullYear() - Number(date.slice(0, 4)));
    if (age >= 0)
      return { date, year: Number(date.slice(0, 4)), ageMin: Math.max(0, age - 1), ageMax: age };
  }
  if (date && birth) {
    const [year, month, day] = date.split('-').map(Number);
    const first = new Date(Date.UTC(year!, month! - 1, day ?? 1));
    const last = new Date(Date.UTC(year!, month! - 1, day ?? 28));
    const from = ageOnDate(birth, first);
    const to = ageOnDate(birth, last);
    if (Number.isFinite(from) && from >= 0) return { date, year: year!, ageMin: from, ageMax: to };
  }
  const ageMin = input.ageMin ?? null;
  return {
    date,
    year: date ? Number(date.slice(0, 4)) : (input.year ?? null),
    ageMin,
    ageMax: ageMin === null ? null : Math.max(ageMin, input.ageMax ?? ageMin),
  };
}

function link(milestoneId: string, memoryIds: string[]) {
  run('DELETE FROM milestone_memories WHERE milestone_id = ?', milestoneId);
  for (const memoryId of memoryIds) {
    if (get('SELECT id FROM memories WHERE id = ?', memoryId)) {
      run(
        'INSERT OR IGNORE INTO milestone_memories (milestone_id, memory_id) VALUES (?, ?)',
        milestoneId,
        memoryId,
      );
    }
  }
}

export function createMilestone(input: MilestoneInput): MilestoneDto {
  const id = newId();
  const when = placement(input);
  transaction(() => {
    run(
      'INSERT INTO milestones (id, title, age_min, age_max, year, date, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      input.title,
      when.ageMin,
      when.ageMax,
      when.year,
      when.date,
      input.description ?? null,
      now(),
    );
    link(id, input.memoryIds);
  });
  return toDto(get<MilestoneRow>('SELECT * FROM milestones WHERE id = ?', id)!);
}

export function updateMilestone(id: string, input: MilestoneInput): MilestoneDto {
  if (!get('SELECT id FROM milestones WHERE id = ?', id)) throw notFound('Milestone');
  const when = placement(input);
  transaction(() => {
    run(
      'UPDATE milestones SET title = ?, age_min = ?, age_max = ?, year = ?, date = ?, description = ? WHERE id = ?',
      input.title,
      when.ageMin,
      when.ageMax,
      when.year,
      when.date,
      input.description ?? null,
      id,
    );
    link(id, input.memoryIds);
  });
  return toDto(get<MilestoneRow>('SELECT * FROM milestones WHERE id = ?', id)!);
}

export function deleteMilestone(id: string) {
  run("DELETE FROM connection_endpoints WHERE node_type = 'milestone' AND node_id = ?", id);
  run('DELETE FROM milestones WHERE id = ?', id);
}
