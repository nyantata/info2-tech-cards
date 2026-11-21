// Synthetic identities only. No passwords, real addresses, or school identifiers.
export const students = Array.from({ length: 36 }, (_, index) => ({
  studentId: `3K${String(index + 1).padStart(2, '0')}`,
  academicYear: 2026,
  email: `learner${String(index + 1).padStart(2, '0')}@school.example.invalid`,
  sub: `synthetic-google-sub-${index + 1}`,
  role: 'student'
}));

export function submission(overrides = {}) {
  return {
    mode: '個人', recordDate: '2026/01/15', representative: '架空生徒', project: '架空プロジェクト',
    problem: '照度の差を調べる', cards: ['iot', 'visualization'], cardReason: '測定して比較するため',
    process: '照度を測り、表にまとめた', result: '場所による違いがあった', next: '時刻を揃えて再測定する',
    clientSubmissionId: 'synthetic-submission-0001', attachments: [], ...overrides
  };
}

export function image(number = 1) {
  return {
    clientImageId: `synthetic-image-${String(number).padStart(8, '0')}`,
    originalName: 'synthetic.png', storedName: 'synthetic.png', mimeType: 'image/png', width: 1, height: 1,
    dataBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
  };
}
