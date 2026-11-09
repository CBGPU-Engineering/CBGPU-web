import 'server-only';
import {readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {deriveStudyConnection} from './studyConnection';
import type {StudyConnection} from './studyConnection';
export type {StudyConnection};

export async function readStudyConnection(): Promise<StudyConnection> {
  const file = process.env.CBGPU_STUDY_STATUS_FILE || path.join(os.homedir(), '.local/share/cbgpu-study-monitor/status.json');
  try {
    return deriveStudyConnection(JSON.parse(await readFile(file, 'utf8')));
  } catch {
    return deriveStudyConnection(null);
  }
}
