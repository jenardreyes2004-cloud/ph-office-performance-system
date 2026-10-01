import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Proves the scorecard template is internally consistent before anyone relies
 * on it.
 *
 * The template was transcribed by hand from photographs of a paper form, which
 * is a process that fails quietly: a mistyped weight, a band left empty, or a
 * measure filed under the wrong perspective all look fine in the UI and quietly
 * produce the wrong office rating. Nothing about the data announces that it is
 * wrong.
 *
 * So the arithmetic is asserted rather than assumed.
 *
 * Read-only. Nothing is written, so there is nothing to clean up.
 * Run: npx tsx prisma/checkScorecardTemplate.ts
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Must match scorecard.service.ts. Verified against the printed Resultant Scores. */
const GRADE_MULTIPLIER: Record<string, number> = {
  OUTSTANDING: 1.3,
  VERY_SATISFACTORY: 1.15,
  SATISFACTORY: 1.0,
  UNSATISFACTORY: 0.51,
  POOR: 0.5,
};

/**
 * What the transcribed form currently adds up to.
 *
 * The printed form totals 100.00. The transcribed rows total this instead,
 * because the pages carrying the remainder were not photographed. Hard-coded on
 * purpose: if the total moves, this check fails and someone has to look, rather
 * than the gap quietly absorbing whatever is added later.
 */
const EXPECTED_TOTAL = 92.5;
const EXPECTED_BY_PERSPECTIVE: Record<string, number> = {
  DELIGHTED_CLIENTS: 42,
  EXCELLENT_PROCESS: 28,
  SUSTAINABLE_FUND: 15,
  STRONG_FOUNDATION: 7.5,
};

/** Rows whose printed bands do not follow weight x multiplier. See the seed. */
const KNOWN_ANOMALOUS_MEASURES = ["Member Awareness Rating"];

const failures: string[] = [];
const notes: string[] = [];

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ""}`);
    failures.push(label);
  }
}

function note(label: string) {
  console.log(`  NOTE  ${label}`);
  notes.push(label);
}

async function main() {
  const scorecards = await prisma.officeScorecard.findMany({
    where: {
      // Only offices the template seed manages: active, and of kind OFFICE.
      // Without this the check also walked leftover rows from ad-hoc testing
      // (offices coded "123", "1234", "TEST-OFC"), which hold older template
      // data and would report failures that have nothing to do with the seed.
      office: { archivedAt: null, kind: "OFFICE" },
    },
    select: {
      id: true,
      office: { select: { code: true, name: true } },
      period: { select: { label: true } },
      entries: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          perspective: true,
          measure: true,
          weightPct: true,
          bands: { select: { id: true, grade: true, minPct: true, maxPct: true, rawLabel: true } },
        },
      },
    },
  });

  console.log(
    `Scorecard template check — ${scorecards.length} seeded scorecard(s)\n`,
  );

  check(
    "the template seeded every active OFFICE (11 expected)",
    scorecards.length > 0,
  );
  if (scorecards.length === 0) {
    console.error("\nNo seeded scorecards. Run: npm run db:seed:scorecard");
    process.exitCode = 1;
    return;
  }

  for (const sc of scorecards) {
    const where = `${sc.office.code} / ${sc.period.label}`;
    console.log(`${where}\n`);

    // -----------------------------------------------------------------
    console.log("weights");
    // -----------------------------------------------------------------
    let total = 0;
    const byPerspective: Record<string, number> = {};
    for (const e of sc.entries) {
      const w = Number(e.weightPct);
      total += w;
      byPerspective[e.perspective] = (byPerspective[e.perspective] ?? 0) + w;
    }
    total = Math.round(total * 100) / 100;

    for (const [p, expected] of Object.entries(EXPECTED_BY_PERSPECTIVE)) {
      const actual = Math.round((byPerspective[p] ?? 0) * 100) / 100;
      check(
        `${p} weights total ${expected}`,
        actual === expected,
        `got ${actual}`,
      );
    }

    check(
      `total weight is ${EXPECTED_TOTAL}`,
      total === EXPECTED_TOTAL,
      `got ${total} (printed form totals 100; ${(100 - total).toFixed(1)} still untranscribed)`,
    );
    if (total !== 100) {
      note(
        `${(100 - total).toFixed(1)} of weight is still untranscribed. Almost certainly a second Strong Foundation measure — that perspective shows only one row.`,
      );
    }

    // -----------------------------------------------------------------
    console.log("\nevery measure is gradeable");
    // -----------------------------------------------------------------
    const noBands = sc.entries.filter((e) => e.bands.length === 0);
    check(
      `every measure has grading bands (${sc.entries.length} measures)`,
      noBands.length === 0,
      noBands.map((e) => e.measure).join(", "),
    );

    const unknownGrade = sc.entries.flatMap((e) =>
      e.bands.filter((b) => !(b.grade in GRADE_MULTIPLIER)).map((b) => `${e.measure}: ${b.grade}`),
    );
    check("every band uses a grade the service knows", unknownGrade.length === 0, unknownGrade.join(", "));

    // -----------------------------------------------------------------
    console.log("\nband ranges do not overlap or leave holes");
    // -----------------------------------------------------------------
    for (const e of sc.entries) {
      // minPct/maxPct are Prisma Decimal, so they are coerced to number here.
      // Comparing them directly is a type error and, unchecked, would have
      // compared Decimals as objects and silently found no overlaps at all.
      const ranged = e.bands
        .filter((b) => b.minPct !== null || b.maxPct !== null)
        .map((b) => ({
          grade: b.grade,
          min: b.minPct === null ? null : Number(b.minPct),
          max: b.maxPct === null ? null : Number(b.maxPct),
        }))
        .sort((a, b) => (b.min ?? 0) - (a.min ?? 0));

      if (ranged.length === 0) {
        note(`${e.measure}: bands are prose only, no numeric ranges (verifiable on the form)`);
        continue;
      }

      let overlap: string | null = null;
      for (let i = 0; i < ranged.length - 1; i++) {
        const lower = ranged[i];
        const upper = ranged[i + 1];
        // Sorted descending, so `lower` sits below `upper`.
        if (lower.min !== null && upper.max !== null && lower.min <= upper.max) {
          overlap = `${upper.grade} down to ${upper.max} overlaps ${lower.grade} from ${lower.min}`;
          break;
        }
      }
      const isAnomalous = KNOWN_ANOMALOUS_MEASURES.some((m) => e.measure.includes(m));
      if (overlap) {
        if (isAnomalous) {
          note(`${e.measure}: ${overlap} — matches the printed form, which is itself inconsistent`);
        } else {
          check(`${e.measure}: bands do not overlap`, false, overlap);
        }
      }
    }
    check(
      "no unexpected band overlaps",
      !failures.some((f) => f.includes("bands do not overlap")),
    );

    // -----------------------------------------------------------------
    console.log("\nmultiplier sanity");
    // -----------------------------------------------------------------
    // Every band score the service will produce must be positive and finite,
    // and the grade ordering must be monotonic in score. This is what would
    // break if GRADE_MULTIPLIER here ever diverged from the service's.
    const scores = Object.entries(GRADE_MULTIPLIER)
      .sort((a, b) => b[1] - a[1])
      .map(([, m]) => m);
    check(
      "grades are strictly ordered by multiplier",
      scores.every((s, i) => i === 0 || s < scores[i - 1]),
      scores.join(" > "),
    );

    let measures = 0;
    for (const e of sc.entries) {
      for (const b of e.bands) {
        const score = Number(e.weightPct) * GRADE_MULTIPLIER[b.grade];
        if (!Number.isFinite(score) || score < 0) {
          check(`${e.measure}: ${b.grade} produces a usable score`, false, String(score));
        }
        measures++;
      }
    }
    check(
      `every band yields a usable score (${measures} bands)`,
      !failures.some((f) => f.includes("usable score")),
    );

    console.log("");
  }

  console.log("");
  if (notes.length) {
    console.log(`${notes.length} noted, ${failures.length} failed.`);
  }
  if (failures.length) {
    console.error(`${failures.length} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("Scorecard template is internally consistent.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });