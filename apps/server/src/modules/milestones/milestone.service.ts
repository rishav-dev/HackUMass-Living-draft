import type { MilestoneDto, MilestoneInput } from '@living-draft/contracts';
import { all, get, run, transaction } from '../../db/database';
import { newId, notFound, now } from '../../lib/http';
import type { MilestoneRow } from '../archive/rows';

function toDto(row: MilestoneRow): MilestoneDto {
  return {
    id: row.id,
    title: row.title,
    ageMin: row.age_min,
    ageMax: row.age_max,
    year: row.year,
    description: row.description,
    memoryIds: all<{ memory_id: string }>(
      'SELECT memory_id FROM milestone_memories WHERE milestone_id = ?',
      row.id,
    ).map((r) => r.memory_id),
  };
}

export function listMilestones(): MilestoneDto[] {
  return all<MilestoneRow>('SELECT * FROM milestones ORDER BY COALESCE(age_min, 999), title').map(
    toDto,
  );
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
  transaction(() => {
    run(
      'INSERT INTO milestones (id, title, age_min, age_max, year, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id,
      input.title,
      input.ageMin,
      input.ageMax ?? input.ageMin,
      input.year ?? null,
      input.description ?? null,
      now(),
    );
    link(id, input.memoryIds);
  });
  return toDto(get<MilestoneRow>('SELECT * FROM milestones WHERE id = ?', id)!);
}

export function updateMilestone(id: string, input: MilestoneInput): MilestoneDto {
  if (!get('SELECT id FROM milestones WHERE id = ?', id)) throw notFound('Milestone');
  transaction(() => {
    run(
      'UPDATE milestones SET title = ?, age_min = ?, age_max = ?, year = ?, description = ? WHERE id = ?',
      input.title,
      input.ageMin,
      input.ageMax ?? input.ageMin,
      input.year ?? null,
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
