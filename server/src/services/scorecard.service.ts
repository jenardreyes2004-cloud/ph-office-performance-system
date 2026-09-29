import { prisma } from "@/prisma/client";
import { AppError } from "@/middleware/errorHandler";
import type { Prisma, ScorecardGrade } from "@/generated/prisma/client";

import type {
  CreateScorecardPeriodInput,
  CreateOfficeScorecardInput,
  UpdateOfficeScorecardInput,
  CreateScorecardEntryInput,
  UpdateScorecardEntryInput,
  ReplaceScorecardBandsInput,
  SubmitScorecardResultInput,
  OverrideFinalScoreInput,
} from "@/schemas/scorecard.schema";

// PhilHealth SPMS grade-to-multiplier table. A grade's Resultant Score is always
// its measure's weight multiplied by this fixed percentage — confirmed by
// cross-checking every weight/score pair present on the source scorecard.
const GRADE_MULTIPLIER: Record<ScorecardGrade, number> = {
  OUTSTANDING: 1.3,
  VERY_SATISFACTORY: 1.15,
  SATISFACTORY: 1.0,
  UNSATISFACTORY: 0.51,
  POOR: 0.5,
};

// Same bands, expressed as a fraction of the *total* weight, for the office-level rollup.
const RATING_THRESHOLDS: { grade: ScorecardGrade; min: number }[] = [
  { grade: "OUTSTANDING", min: 1.3 },
  { grade: "VERY_SATISFACTORY", min: 1.15 },
  { grade: "SATISFACTORY", min: 1.0 },
  { grade: "UNSATISFACTORY", min: 0.51 },
  { grade: "POOR", min: 0 },
];

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function computeEntryScore(weightPct: number, grade: ScorecardGrade): number {
  return round2(weightPct * GRADE_MULTIPLIER[grade]);
}

function computeOfficeRating(totalScore: number, totalWeight: number): ScorecardGrade {
  if (totalWeight <= 0) return "POOR";
  const ratio = totalScore / totalWeight;
  const match = RATING_THRESHOLDS.find((t) => ratio >= t.min);
  return match?.grade ?? "POOR";
}

// If the reported result is a clean percentage and exactly one band's numeric
// range contains it, we can auto-grade. Anything ambiguous (overlapping bands,
// no numeric bands at all, or no match) falls back to requiring a manual grade.
function autoSuggestGrade(
  bands: { grade: ScorecardGrade; minPct: unknown; maxPct: unknown }[],
  resultPct: number,
): ScorecardGrade | null {
  const numericBands = bands.filter((b) => b.minPct !== null || b.maxPct !== null);
  const matches = numericBands.filter((b) => {
    const min = b.minPct !== null ? Number(b.minPct) : -Infinity;
    const max = b.maxPct !== null ? Number(b.maxPct) : Infinity;
    return resultPct >= min && resultPct <= max;
  });
  return matches.length === 1 ? matches[0].grade : null;
}

// `satisfies` (not `as const` and not a type annotation) so these keep their
// literal types: `as const` makes the `orderBy` arrays readonly tuples that
// Prisma's input types reject, and a plain annotation widens `true` to
// `boolean`, which erases nested relations from the result payload.
const ENTRY_INCLUDE = {
  bands: { orderBy: { grade: "asc" } },
  result: true,
} satisfies Prisma.ScorecardEntryInclude;

const OFFICE_SCORECARD_INCLUDE = {
  office: true,
  period: true,
  finalizedBy: { select: { id: true, name: true, email: true, role: true } },
  entries: { orderBy: [{ perspective: "asc" }, { sortOrder: "asc" }], include: ENTRY_INCLUDE },
} satisfies Prisma.OfficeScorecardInclude;

export const scorecardPeriodService = {
  async list() {
    return prisma.scorecardPeriod.findMany({ orderBy: { startDate: "desc" } });
  },

  async create(data: CreateScorecardPeriodInput) {
    if (data.endDate < data.startDate) {
      throw new AppError("End date cannot be earlier than start date", 400);
    }
    return prisma.scorecardPeriod.create({ data });
  },

  async getById(id: string) {
    const period = await prisma.scorecardPeriod.findUnique({ where: { id } });
    if (!period) throw new AppError("Scorecard period not found", 404);
    return period;
  },

  // Every office, alongside its scorecard for this period if one exists yet.
  // This is the "click into an office" list view.
  //
  // Only head offices appear: the sub-divisions and units under them are
  // tracked for structure, plans, and employees, but the SPMS scorecard is
  // filled out at the head-office level (see the isHeadOffice column).
  async listOfficesForPeriod(periodId: string) {
    await this.getById(periodId);

    const offices = await prisma.office.findMany({
      where: { archivedAt: null, isHeadOffice: true },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { employees: true } },
        officeScorecards: {
          where: { periodId },
          select: {
            id: true,
            status: true,
            totalWeight: true,
            totalScore: true,
            officeRating: true,
            finalizedAt: true,
          },
        },
      },
    });

    return offices.map((o) => ({
      officeId: o.id,
      officeName: o.name,
      officeCode: o.code,
      employeeCount: o._count.employees,
      scorecard: o.officeScorecards[0] ?? null,
    }));
  },

  // Ancestor chain, root first. The scorecard sign-off block prints the
  // rater's next higher supervisor, so the report view needs to know where
  // this office sits in the structure.
  async getPath(id: string) {
    const office = await prisma.office.findUnique({
      where: { id },
      select: { id: true, name: true, code: true, parentId: true },
    });
    if (!office) throw new AppError("Office not found", 404);

    const chain = [office];
    let current = office.parentId;
    for (let i = 0; i < 50 && current; i++) {
      const parent: { id: string; name: string; code: string; parentId: string | null } | null =
        await prisma.office.findUnique({
          where: { id: current },
          select: { id: true, name: true, code: true, parentId: true },
        });
      if (!parent) break;
      chain.push(parent);
      current = parent.parentId;
    }

    return chain.reverse();
  },
};

export const officeScorecardService = {
  async getById(id: string) {
    const scorecard = await prisma.officeScorecard.findUnique({
      where: { id },
      include: OFFICE_SCORECARD_INCLUDE,
    });
    if (!scorecard) throw new AppError("Office scorecard not found", 404);
    return scorecard;
  },

  async create(officeId: string, periodId: string, data: CreateOfficeScorecardInput) {
    const office = await prisma.office.findUnique({ where: { id: officeId } });
    if (!office) throw new AppError("Office not found", 404);

    await scorecardPeriodService.getById(periodId); // 404s if missing

    const existing = await prisma.officeScorecard.findUnique({
      where: { officeId_periodId: { officeId, periodId } },
    });
    if (existing) {
      throw new AppError("This office already has a scorecard for this period", 409);
    }

    const scorecard = await prisma.officeScorecard.create({
      data: {
        officeId,
        periodId,
        entries: data.entries
          ? {
              create: data.entries.map((e) => ({
                perspective: e.perspective,
                sortOrder: e.sortOrder,
                strategicObjective: e.strategicObjective,
                responsibleUnit: e.responsibleUnit,
                measure: e.measure,
                performanceTarget: e.performanceTarget,
                weightPct: e.weightPct,
                bands: { create: e.bands },
              })),
            }
          : undefined,
      },
      include: OFFICE_SCORECARD_INCLUDE,
    });

    return scorecard;
  },

  async update(id: string, data: UpdateOfficeScorecardInput) {
    const scorecard = await this.getById(id);
    if (scorecard.status === "FINALIZED") {
      throw new AppError("This scorecard is finalized and can no longer be edited", 409);
    }
    return prisma.officeScorecard.update({
      where: { id },
      data,
      include: OFFICE_SCORECARD_INCLUDE,
    });
  },

  async finalize(id: string, finalizedByUserId: string) {
    const scorecard = await this.getById(id);

    if (scorecard.status === "FINALIZED") {
      throw new AppError("This scorecard is already finalized", 409);
    }

    if (scorecard.entries.length === 0) {
      throw new AppError("Cannot finalize a scorecard with no measures", 422);
    }

    const missingResults = scorecard.entries.filter((e) => !e.result?.grade);
    if (missingResults.length > 0) {
      throw new AppError(
        `${missingResults.length} measure(s) still need a result and grade before finalizing: ` +
          missingResults.map((e) => e.measure).join("; "),
        422,
      );
    }

    const totalWeight = scorecard.entries.reduce((sum, e) => sum + Number(e.weightPct), 0);
    const totalScore = scorecard.entries.reduce((sum, e) => {
      const score = e.result?.finalScore ?? e.result?.initialScore ?? 0;
      return sum + Number(score);
    }, 0);
    const officeRating = computeOfficeRating(totalScore, totalWeight);

    return prisma.officeScorecard.update({
      where: { id },
      data: {
        status: "FINALIZED",
        totalWeight: round2(totalWeight),
        totalScore: round2(totalScore),
        officeRating,
        finalizedAt: new Date(),
        finalizedByUserId,
      },
      include: OFFICE_SCORECARD_INCLUDE,
    });
  },
};

async function assertEditable(entryId: string) {
  const entry = await prisma.scorecardEntry.findUnique({
    where: { id: entryId },
    include: { officeScorecard: { select: { status: true } } },
  });
  if (!entry) throw new AppError("Scorecard entry not found", 404);
  if (entry.officeScorecard.status === "FINALIZED") {
    throw new AppError("This scorecard is finalized and can no longer be edited", 409);
  }
  return entry;
}

export const scorecardEntryService = {
  async addEntry(officeScorecardId: string, data: CreateScorecardEntryInput) {
    const scorecard = await officeScorecardService.getById(officeScorecardId);
    if (scorecard.status === "FINALIZED") {
      throw new AppError("This scorecard is finalized and can no longer be edited", 409);
    }

    return prisma.scorecardEntry.create({
      data: {
        officeScorecardId,
        perspective: data.perspective,
        sortOrder: data.sortOrder,
        strategicObjective: data.strategicObjective,
        responsibleUnit: data.responsibleUnit,
        measure: data.measure,
        performanceTarget: data.performanceTarget,
        weightPct: data.weightPct,
        bands: { create: data.bands },
      },
      include: ENTRY_INCLUDE,
    });
  },

  async updateEntry(id: string, data: UpdateScorecardEntryInput) {
    await assertEditable(id);
    return prisma.scorecardEntry.update({ where: { id }, data, include: ENTRY_INCLUDE });
  },

  async deleteEntry(id: string) {
    await assertEditable(id);
    await prisma.scorecardEntry.delete({ where: { id } });
  },

  async replaceBands(id: string, data: ReplaceScorecardBandsInput) {
    await assertEditable(id);

    return prisma.$transaction(async (tx) => {
      await tx.scorecardBand.deleteMany({ where: { entryId: id } });
      await tx.scorecardBand.createMany({
        data: data.bands.map((b) => ({ ...b, entryId: id })),
      });
      return tx.scorecardEntry.findUniqueOrThrow({ where: { id }, include: ENTRY_INCLUDE });
    });
  },
};

export const scorecardResultService = {
  async submit(entryId: string, data: SubmitScorecardResultInput) {
    const entry = await assertEditable(entryId);
    const bands = await prisma.scorecardBand.findMany({ where: { entryId } });

    let grade = data.grade ?? null;
    let isAutoGraded = false;

    if (!grade && data.resultPct !== undefined) {
      grade = autoSuggestGrade(bands, data.resultPct);
      isAutoGraded = grade !== null;
    }

    if (!grade) {
      throw new AppError(
        "Could not determine a grade automatically — please select one of this measure's bands explicitly.",
        422,
      );
    }

    const initialScore = computeEntryScore(Number(entry.weightPct), grade);

    return prisma.scorecardResult.upsert({
      where: { entryId },
      create: {
        entryId,
        rawResult: data.rawResult,
        resultPct: data.resultPct,
        grade,
        isAutoGraded,
        initialScore,
        finalScore: initialScore,
        notes: data.notes,
      },
      update: {
        rawResult: data.rawResult,
        resultPct: data.resultPct,
        grade,
        isAutoGraded,
        initialScore,
        finalScore: initialScore,
        notes: data.notes,
      },
    });
  },

  // A supervisor correcting the score after review — mirrors the printed
  // form's separate "Initial" / "Final" Resultant Score columns.
  async overrideFinalScore(entryId: string, data: OverrideFinalScoreInput) {
    await assertEditable(entryId);

    const result = await prisma.scorecardResult.findUnique({ where: { entryId } });
    if (!result) {
      throw new AppError("Submit a result for this measure before overriding its score", 404);
    }

    return prisma.scorecardResult.update({
      where: { entryId },
      data: { finalScore: data.finalScore, notes: data.notes ?? result.notes },
    });
  },
};
