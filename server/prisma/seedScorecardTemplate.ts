import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Source: photographed "OFFICE-LEVEL PERFORMANCE SCORECARD" form, PhilHealth
// Regional Office - National Capital Region, period Jan 2025 - Dec 2025.
//
// IMPORTANT — two known gaps, transcribed from photos of a physical form:
//
// 1. Weights only total 92.5%, not 100% (Delighted Clients 42 + Excellent
//    Process 23 + Sustainable Fund 20 + Strong Foundation 7.5). Strong
//    Foundation shows only one measure here, which is thin next to the
//    other three perspectives — there are almost certainly more Strong
//    Foundation rows on a page that wasn't photographed. Add them to
//    STRONG_FOUNDATION below once you have them; nothing else needs to
//    change.
//
// 2. "Member Awareness Rating" (Strengthen Relationships with Stakeholders /
//    PAU, LHIOs) has its grading bands cut off at the photo's edge — that
//    entry below is seeded with everything except bands (bands: []). Add
//    its 5 bands directly on that entry once you have that cell.
//
// Every other band's percentage thresholds are transcribed as legibly as
// the source photos allowed. The multiplier applied to each grade
// (O=130%, VS=115%, S=100%, US=51%, P=50%) is verified exactly against
// every printed "Resultant Score" on the form and matches
// scorecard.service.ts's GRADE_MULTIPLIER table — that part is not a guess.
// ---------------------------------------------------------------------------

type Grade = "OUTSTANDING" | "VERY_SATISFACTORY" | "SATISFACTORY" | "UNSATISFACTORY" | "POOR";

interface BandInput {
  grade: Grade;
  minPct?: number;
  maxPct?: number;
  rawLabel: string;
}

interface EntryInput {
  perspective: "DELIGHTED_CLIENTS" | "EXCELLENT_PROCESS" | "SUSTAINABLE_FUND" | "STRONG_FOUNDATION";
  strategicObjective: string;
  responsibleUnit?: string;
  measure: string;
  performanceTarget: string;
  weightPct: number;
  bands: BandInput[];
}

function standardBands(
  weightPct: number,
  labels: { O: string; VS: string; S: string; US: string; P: string },
  ranges?: Partial<Record<Grade, { min?: number; max?: number }>>,
): BandInput[] {
  const order: { grade: Grade; label: keyof typeof labels }[] = [
    { grade: "OUTSTANDING", label: "O" },
    { grade: "VERY_SATISFACTORY", label: "VS" },
    { grade: "SATISFACTORY", label: "S" },
    { grade: "UNSATISFACTORY", label: "US" },
    { grade: "POOR", label: "P" },
  ];
  return order.map(({ grade, label }) => ({
    grade,
    rawLabel: labels[label],
    minPct: ranges?.[grade]?.min,
    maxPct: ranges?.[grade]?.max,
  }));
}

const DELIGHTED_CLIENTS: EntryInput[] = [
  {
    perspective: "DELIGHTED_CLIENTS",
    strategicObjective: "Increase utilization of benefits with focus on primary care services",
    responsibleUnit: "Branch Offices, LHIOs, PCARES, PAMS, YAKAP Team",
    measure: "Percentage beneficiaries registered to the YAKAP Program (Formerly Konsulta Program)",
    performanceTarget: "100% of the Target (5,941,662)",
    weightPct: 4.0,
    bands: standardBands(
      4.0,
      {
        O: "90-100% of target accomplished by Dec. 31, 2025",
        VS: "80-89% of target accomplished by Dec. 31, 2025",
        S: "70-79% of target accomplished by Dec. 31, 2025",
        US: "50-69% of target accomplished by Dec. 31, 2025",
        P: "below 50% of target accomplished by Dec. 31, 2025",
      },
      {
        OUTSTANDING: { min: 90, max: 100 },
        VERY_SATISFACTORY: { min: 80, max: 89.99 },
        SATISFACTORY: { min: 70, max: 79.99 },
        UNSATISFACTORY: { min: 50, max: 69.99 },
        POOR: { max: 49.99 },
      },
    ),
  },
  {
    perspective: "DELIGHTED_CLIENTS",
    strategicObjective: "Ensure Service Excellence and Member Satisfaction",
    responsibleUnit: "All Offices",
    measure: "EODB Implementation score",
    performanceTarget: "100%",
    weightPct: 5.0,
    bands: standardBands(
      5.0,
      {
        O: "95-100% accomplished by Dec. 31, 2025",
        VS: "90-94.99% accomplished by Dec. 31, 2025",
        S: "85-89.99% accomplished by Dec. 31, 2025",
        US: "80-84.99% accomplished by Dec. 31, 2025",
        P: "79.99% and below accomplished by Dec. 31, 2025",
      },
      {
        OUTSTANDING: { min: 95, max: 100 },
        VERY_SATISFACTORY: { min: 90, max: 94.99 },
        SATISFACTORY: { min: 85, max: 89.99 },
        UNSATISFACTORY: { min: 80, max: 84.99 },
        POOR: { max: 79.99 },
      },
    ),
  },
  {
    perspective: "DELIGHTED_CLIENTS",
    strategicObjective: "Increase utilization of benefits with focus on primary care services",
    responsibleUnit: "Branch Offices, LHIOs, PCARES, PAMS, YAKAP Team",
    measure: "Percentage of Konsulta registered beneficiaries with First Patient Encounter (PFE)",
    performanceTarget: "100% of the Target (3.5M)",
    weightPct: 5.0,
    bands: standardBands(
      5.0,
      {
        O: "100% and above of target accomplished by Dec. 31, 2025",
        VS: "90-99.99% of target accomplished by Dec. 31, 2025",
        S: "80-89.99% of target accomplished by Dec. 31, 2025",
        US: "70-79.99% of target accomplished by Dec. 31, 2025",
        P: "below 70% of target accomplished by Dec. 31, 2025",
      },
      {
        OUTSTANDING: { min: 100 },
        VERY_SATISFACTORY: { min: 90, max: 99.99 },
        SATISFACTORY: { min: 80, max: 89.99 },
        UNSATISFACTORY: { min: 70, max: 79.99 },
        POOR: { max: 69.99 },
      },
    ),
  },
  {
    perspective: "DELIGHTED_CLIENTS",
    strategicObjective: "Expanded access to high-quality health services",
    responsibleUnit: "HCDMD, AQAS, YAKAP Team",
    measure:
      "No. of Full Time/Full Time Equivalent KP MD in each municipality/city that can serve at least 50% of the population",
    performanceTarget: "based on population of each municipality/city at a ratio of 1FT MD:20,000 population",
    weightPct: 3.0,
    bands: standardBands(
      3.0,
      {
        O: "at least 95% of target no. of KP MDs can cover at least 50% of the population by Dec. 2025",
        VS: "90-94% of target no. of KP MDs can cover at least 50% of the population by Dec. 2025",
        S: "80-90% of target no. of KP MDs can cover at least 50% of the population by Dec. 2025",
        US: "KP MDs can cover 20-49% of the population by Dec. 2025",
        P: "KP MDs can cover less than 20% of the population by Dec. 2025",
      },
      {
        OUTSTANDING: { min: 95 },
        VERY_SATISFACTORY: { min: 90, max: 94.99 },
        SATISFACTORY: { min: 80, max: 90 },
        UNSATISFACTORY: { min: 20, max: 49.99 },
        POOR: { max: 19.99 },
      },
    ),
  },
  {
    perspective: "DELIGHTED_CLIENTS",
    strategicObjective: "Expanded access to high-quality health services",
    responsibleUnit: "HCDMD, AQAS, YAKAP Team",
    measure: "Percentage of municipalities/cities with an accredited Konsulta Package provider",
    performanceTarget: "100% (19 LGUs)",
    weightPct: 4.0,
    bands: standardBands(
      4.0,
      {
        O: "Outstanding = 95-100% accomplished by Dec. 31, 2025",
        VS: "Very Satisfactory = 91-94% accomplished by Dec. 31, 2025",
        S: "Satisfactory = 80-90% accomplished by Dec. 31, 2025",
        US: "Unsatisfactory = 70-79% accomplished by Dec. 31, 2025",
        P: "Poor = below 70% accomplished by Dec. 31, 2025",
      },
      {
        OUTSTANDING: { min: 95, max: 100 },
        VERY_SATISFACTORY: { min: 91, max: 94.99 },
        SATISFACTORY: { min: 80, max: 90 },
        UNSATISFACTORY: { min: 70, max: 79.99 },
        POOR: { max: 69.99 },
      },
    ),
  },
  {
    perspective: "DELIGHTED_CLIENTS",
    strategicObjective: "Expanded access to high-quality health services",
    responsibleUnit: "HCDMD, AQAS, ReachOut",
    measure: "Number of Z benefit packages/contracts retained and newly contracted",
    performanceTarget: "Current Z-benefit packages/contracts retained plus 1 new contracted package per PRO or Branch",
    weightPct: 4.0,
    bands: standardBands(4.0, {
      O: "Outstanding = Current Z benefit packages/contracts retained plus more than 1 new contracted and on process",
      VS: "Very Satisfactory = Current Z benefit packages/contracts retained plus 1 new contracted and on process",
      S: "Satisfactory = Current Z benefit packages/contracts retained plus 1 new contracted",
      US: "Unsatisfactory = Current Z benefit packages/contracts retained and identified potential Z benefit package providers per branch with accomplished SATs",
      P: "Poor = Current Z benefit packages decreased or no identified potential Z benefit package provider per branch, accomplished SATs",
    }),
  },
  {
    perspective: "DELIGHTED_CLIENTS",
    strategicObjective: "Expand Service Coverage and Quality",
    responsibleUnit: "HCDMD, AQAS, ReachOut",
    measure: "Percentage of implementation of shadow billing in selected hospital sites",
    performanceTarget: "100% (29 sites)",
    weightPct: 5.0,
    bands: standardBands(5.0, {
      O: "Outstanding = 100% accomplished by Oct. 31, 2025",
      VS: "Very Satisfactory = 100% accomplished by Nov. 30, 2025",
      S: "Satisfactory = 100% accomplished by Dec. 31, 2025",
      US: "Unsatisfactory = 70-99% accomplished by Dec. 31, 2025",
      P: "Poor = below 70% accomplished by Dec. 31, 2025",
    }),
  },
  {
    perspective: "DELIGHTED_CLIENTS",
    strategicObjective: "Strengthen Relationship with Stakeholders",
    responsibleUnit: "All Offices",
    measure: "Percentage of Satisfied Customers based on ARTA CS Tool",
    performanceTarget: ">90% (CCC)",
    weightPct: 3.0,
    bands: standardBands(3.0, {
      O: "Outstanding = 96% and above of the Respondents who have Rated at least \"agree\" and \"Strongly Agree\" by the end of the year",
      VS: "Very Satisfaction = 95-99% of the Respondents who have Rated at least \"agree\" and \"Strongly Agree\" by the end of the year",
      S: "Satisfaction = 90-94% of the Respondents who have Rated at least \"agree\" and \"Strongly Agree\" by the end of the year",
      US: "Unsatisfactory = 85-89% of the Respondents who have Rated at least \"agree\" and \"Strongly Agree\" by the end of the year",
      P: "Poor = below 85% of the Respondents who have Rated at least \"agree\" and \"Strongly Agree\" by the end of the year",
    }),
  },
  {
    perspective: "DELIGHTED_CLIENTS",
    strategicObjective: "Enhance member and provider experience through streamline policies and processes",
    responsibleUnit: "Membership Section, LHIOs",
    measure: "Member Registration Rate (Direct and Indirect Contributors) based on the projected population of the PSA",
    performanceTarget: "95% of the projected population by the end of 2025 (100%=16,862,243)",
    weightPct: 5.0,
    bands: standardBands(5.0, {
      O: "Outstanding = 95-100% registered members by end of the year",
      VS: "Very Satisfaction = 85-89% registered members by end of the year",
      S: "Satisfaction = 80-84% registered members by end of the year",
      US: "Unsatisfactory = 70-79% registered members by end of the year",
      P: "Poor = below 70% registered members by end of the year",
    }),
  },
  {
    // INCOMPLETE — bands cut off at the photo's edge. See file header note.
    perspective: "DELIGHTED_CLIENTS",
    strategicObjective: "Strengthen Relationships with Stakeholders",
    responsibleUnit: "PAU, LHIOs",
    measure: "Member Awareness Rating",
    performanceTarget: "95% of the PSA projected population by the end of 2025 (100%=16,862,243)",
    weightPct: 4.0,
    bands: [], // TODO: fill in once the full form is available
  },
];

const EXCELLENT_PROCESS: EntryInput[] = [
  {
    perspective: "EXCELLENT_PROCESS",
    strategicObjective: "Ensure operational effectiveness and efficiency",
    responsibleUnit: "GAD TWG",
    measure: "Implementation of GAD Plans",
    performanceTarget: "100% compliance to GAD Reports/Activities",
    weightPct: 3.0,
    bands: standardBands(3.0, {
      O: "100% compliance, submitted 4 or more days ahead of time, accurate and complete",
      VS: "100% compliance, submitted 1-3 days ahead of time, accurate and complete",
      S: "100% compliance, submitted on time, accurate and complete",
      US: "90-99% compliance, submitted on time, accurate and complete",
      P: "80% and below compliance, submitted on time, accurate and complete",
    }),
  },
  {
    perspective: "EXCELLENT_PROCESS",
    strategicObjective: "Ensure operational effectiveness and efficiency",
    responsibleUnit: "BAS",
    measure: "Claims Processing Efficiency (backlog claims)",
    performanceTarget: "100% (claims received from October 31, 2024 and earlier)",
    weightPct: 5.0,
    bands: standardBands(5.0, {
      O: "98-100% processed on or before Nov. 30, 2025",
      VS: "98-100% processed by Dec. 13, 2025",
      S: "95-97% processed by Dec. 31, 2025",
      US: "94% and below processed by Dec. 31, 2025",
      P: "not processed by Dec. 31, 2025",
    }),
  },
  {
    perspective: "EXCELLENT_PROCESS",
    strategicObjective: "Ensure operational effectiveness and efficiency",
    responsibleUnit: "BAS",
    measure: "Percentage of claims processed within applicable time (claims received and refiled for the current year)",
    performanceTarget: "100% (claims received and refiled for the current year, Nov. 1, 2024 to Oct. 31, 2025)",
    weightPct: 5.0,
    bands: standardBands(5.0, {
      O: "97-100% processed on or before Dec. 13, 2025",
      VS: "95-96% processed by Dec. 13, 2025",
      S: "94-96% processed by Dec. 31, 2025",
      US: "94% and below processed by Dec. 31, 2025",
      P: "93% and below processed by Dec. 31, 2025",
    }),
  },
  {
    perspective: "EXCELLENT_PROCESS",
    strategicObjective: "Boost innovation in research, policy, and process",
    responsibleUnit: "All Offices",
    measure: "Conformance to the ISO 9001:2015 standards and requirements",
    performanceTarget: "Sustain ISO 9001:2015 Certification",
    weightPct: 5.0,
    bands: standardBands(5.0, {
      O: "100% of NCARs responded 1 day ahead of deadline or No NCARs received",
      VS: "100% of NCARs responded on time",
      S: "100% of NCARs responded within deadline",
      // LOW CONFIDENCE: this cell was hard to read in the photo — verify
      // wording against the original form before relying on it.
      US: "NCARs responded near or at the deadline",
      P: "NCARs responded beyond the deadline",
    }),
  },
  {
    perspective: "EXCELLENT_PROCESS",
    strategicObjective: "Stronger Anti-Fraud prevention mechanism",
    responsibleUnit: "Legal Office",
    measure: "Percentage of providers/practitioners with violations investigated",
    performanceTarget: "40% of current complaints/reports received from Jan. 2025 to 31 Oct. 2025 (GCC)",
    weightPct: 5.0,
    bands: standardBands(
      5.0,
      {
        O: "47% and above investigated, accurate and completed on time",
        VS: "41-46% investigated, accurate and completed on time",
        S: "40% investigated, accurate and completed on time",
        US: "35-39% investigated, accurate and completed on time",
        P: "34% and below investigated and completed on time",
      },
      {
        OUTSTANDING: { min: 47 },
        VERY_SATISFACTORY: { min: 41, max: 46.99 },
        SATISFACTORY: { min: 40, max: 40.99 },
        UNSATISFACTORY: { min: 35, max: 39.99 },
        POOR: { max: 34.99 },
      },
    ),
  },
];

const SUSTAINABLE_FUND: EntryInput[] = [
  {
    perspective: "SUSTAINABLE_FUND",
    strategicObjective: "Ensure robust fiscal management through strategic resource allocation",
    responsibleUnit: "FMS_BAS Accounting",
    measure: "Benefit Payment Budget Utilization Rate",
    performanceTarget: "100% (55,677,672.48)",
    weightPct: 5.0,
    bands: standardBands(
      5.0,
      {
        O: "96-100% rate is achieved, accurate and complete adherence to rules and regulations by Dec. 31, 2025",
        VS: "91-95% rate is achieved, accurate and complete adherence to rules and regulations by Dec. 31, 2025",
        S: "85-90% rate is achieved, accurate and complete adherence to rules and regulations by Dec. 31, 2025",
        US: "80-84% rate is achieved, accurate and complete adherence to rules and regulations by Dec. 31, 2025",
        P: "79% and below rate is achieved, accurate and complete adherence to rules and regulations by Dec. 31, 2025",
      },
      {
        OUTSTANDING: { min: 96, max: 100 },
        VERY_SATISFACTORY: { min: 91, max: 95.99 },
        SATISFACTORY: { min: 85, max: 90.99 },
        UNSATISFACTORY: { min: 80, max: 84.99 },
        POOR: { max: 79.99 },
      },
    ),
  },
  {
    perspective: "SUSTAINABLE_FUND",
    strategicObjective: "Ensure robust fiscal management through strategic resource allocation",
    responsibleUnit: "All Cost Centers",
    measure: "Disbursements Budget Utilization Rate (DBUR)",
    performanceTarget: "90%",
    weightPct: 5.0,
    bands: standardBands(
      5.0,
      {
        O: "90-100% by Dec. 31, 2025",
        VS: "80-89% by Dec. 31, 2025",
        S: "70-79% by Dec. 31, 2025",
        US: "60-69% by Dec. 31, 2025",
        P: "below 60% by Dec. 31, 2025",
      },
      {
        OUTSTANDING: { min: 90, max: 100 },
        VERY_SATISFACTORY: { min: 80, max: 89.99 },
        SATISFACTORY: { min: 70, max: 79.99 },
        UNSATISFACTORY: { min: 60, max: 69.99 },
        POOR: { max: 59.99 },
      },
    ),
  },
  {
    perspective: "SUSTAINABLE_FUND",
    strategicObjective: "Ensure robust fiscal management through strategic resource allocation",
    responsibleUnit: "All Cost Centers",
    measure: "Obligations Budget Utilization Rate (OBUR)",
    performanceTarget: "90%",
    weightPct: 5.0,
    bands: standardBands(
      5.0,
      {
        O: "91-100% by Dec. 31, 2025",
        VS: "85-90% by Dec. 31, 2025",
        S: "80-84% by Dec. 31, 2025",
        US: "65-79% by Dec. 31, 2025",
        P: "below 65% by Dec. 31, 2025",
      },
      {
        OUTSTANDING: { min: 91, max: 100 },
        VERY_SATISFACTORY: { min: 85, max: 90.99 },
        SATISFACTORY: { min: 80, max: 84.99 },
        UNSATISFACTORY: { min: 65, max: 79.99 },
        POOR: { max: 64.99 },
      },
    ),
  },
  {
    perspective: "SUSTAINABLE_FUND",
    strategicObjective: "Ensure robust fiscal management through strategic resource allocation",
    responsibleUnit: "Collection Section, LHIOs",
    measure: "Total Amount of Premium Collection (Direct Contributors)",
    performanceTarget: "125,777,641",
    weightPct: 5.0,
    bands: standardBands(5.0, {
      O: "99-100% of target amount collected on time",
      VS: "95-98% of target amount collected on time",
      S: "90-94% of target amount collected on time",
      US: "85-89% of target amount collected on time",
      P: "84% and below of target amount collected on time",
    }),
  },
];

const STRONG_FOUNDATION: EntryInput[] = [
  {
    perspective: "STRONG_FOUNDATION",
    strategicObjective: "Cultivate a high performance culture through strategic human resource management",
    responsibleUnit: "All Offices",
    measure: "Percentage of employees with required competencies",
    performanceTarget: "95%",
    weightPct: 7.5,
    bands: standardBands(
      7.5,
      {
        O: "99-100% of employees with required competencies",
        VS: "96-98% of employees with required competencies",
        S: "95% of employees with required competencies",
        US: "90-94% of employees with required competencies",
        P: "below 90% of employees with required competencies",
      },
      {
        OUTSTANDING: { min: 99, max: 100 },
        VERY_SATISFACTORY: { min: 96, max: 98.99 },
        SATISFACTORY: { min: 95, max: 95.99 },
        UNSATISFACTORY: { min: 90, max: 94.99 },
        POOR: { max: 89.99 },
      },
    ),
  },
  // NOTE: only one Strong Foundation measure was visible in the source
  // photos. Weights across all perspectives total 92.5%, not 100% — this
  // section is almost certainly missing rows. Add them here once available.
];

const TEMPLATE: EntryInput[] = [
  ...DELIGHTED_CLIENTS,
  ...EXCELLENT_PROCESS,
  ...SUSTAINABLE_FUND,
  ...STRONG_FOUNDATION,
];

const PERIOD_LABEL = "January 2025 to December 2025";
const PERIOD_START = new Date("2025-01-01T00:00:00.000Z");
const PERIOD_END = new Date("2025-12-31T23:59:59.000Z");

async function main() {
  const totalWeight = TEMPLATE.reduce((sum, e) => sum + e.weightPct, 0);
  console.log(`Template has ${TEMPLATE.length} entries totaling ${totalWeight}% weight.`);
  if (Math.abs(totalWeight - 100) > 0.01) {
    console.warn(
      `⚠ Weights total ${totalWeight}%, not 100%. This is expected right now — see the ` +
        `file header note about missing Strong Foundation rows. Entries will still seed.`,
    );
  }

  let period = await prisma.scorecardPeriod.findFirst({ where: { label: PERIOD_LABEL } });
  if (!period) {
    period = await prisma.scorecardPeriod.create({
      data: {
        label: PERIOD_LABEL,
        startDate: PERIOD_START,
        endDate: PERIOD_END,
        isActive: true,
      },
    });
  }
  console.log(`Period ready: "${period.label}" (${period.id})`);

  const offices = await prisma.office.findMany({ where: { archivedAt: null } });
  if (offices.length === 0) {
    console.warn("No active offices found — nothing to seed. Create offices first, then re-run.");
    return;
  }

  for (const office of offices) {
    const officeScorecard = await prisma.officeScorecard.upsert({
      where: { officeId_periodId: { officeId: office.id, periodId: period.id } },
      update: {},
      create: {
        officeId: office.id,
        periodId: period.id,
        status: "DRAFT",
      },
    });

    const existingEntryCount = await prisma.scorecardEntry.count({
      where: { officeScorecardId: officeScorecard.id },
    });
    if (existingEntryCount > 0) {
      console.log(`Skipping ${office.name} — scorecard already has ${existingEntryCount} entries.`);
      continue;
    }

    let sortOrder = 0;
    for (const entryInput of TEMPLATE) {
      const entry = await prisma.scorecardEntry.create({
        data: {
          officeScorecardId: officeScorecard.id,
          perspective: entryInput.perspective,
          sortOrder: sortOrder++,
          strategicObjective: entryInput.strategicObjective,
          responsibleUnit: entryInput.responsibleUnit,
          measure: entryInput.measure,
          performanceTarget: entryInput.performanceTarget,
          weightPct: entryInput.weightPct,
        },
      });

      if (entryInput.bands.length > 0) {
        await prisma.scorecardBand.createMany({
          data: entryInput.bands.map((b) => ({
            entryId: entry.id,
            grade: b.grade,
            minPct: b.minPct,
            maxPct: b.maxPct,
            rawLabel: b.rawLabel,
          })),
        });
      }
    }

    console.log(`Seeded ${office.name} with ${TEMPLATE.length} entries.`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
