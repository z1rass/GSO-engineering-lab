import { Pool } from 'pg';

// Explicit local demonstration data. Never run automatically in production.
const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://lab:lab_local@127.0.0.1:55432/lab' });
try {
  await pool.query(`INSERT INTO seasons (number, title, description, starts_on, ends_on, status)
    SELECT 0, 'Build the Lab',
      'Wir bauen unseren eigenen Raum für Technik. Gemeinsam lernen, Projekte starten und die ersten Ideen Wirklichkeit werden lassen.',
      '2026-11-02', '2027-01-15', 'ACTIVE'
    WHERE NOT EXISTS (SELECT 1 FROM seasons WHERE status = 'ACTIVE')
    ON CONFLICT (number) DO NOTHING`);
  console.log('Local Season seed ready. Existing seasons preserved.');
} finally {
  await pool.end();
}
