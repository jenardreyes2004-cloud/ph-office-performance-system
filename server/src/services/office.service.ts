import { prisma } from "@/prisma/client";
import { AppError } from "@/middleware/errorHandler";
import type { OrgNodeKind } from "@/generated/prisma/client";
import type { CreateOfficeInput, UpdateOfficeInput } from "@/schemas/office.schema";

export interface OfficeNode {
  id: string;
  name: string;
  code: string;
  kind: OrgNodeKind;
  isScored: boolean;
  parentId: string | null;
  employeeCount: number;
  // Headcount across the whole subtree, this office included. A division like
  // Management Services owns nobody directly but still has people under it,
  // and that roll-up is the number people actually want to see.
  totalEmployeeCount: number;
  scorecard: {
    id: string;
    status: string;
    officeRating: string | null;
    totalScore: unknown;
  } | null;
  children: OfficeNode[];
}

// Every office that sits *below* `rootId` in the hierarchy. Needed because
// re-parenting has to be checked in both directions: putting an office under
// its own descendant (A under A's child) is just as much a cycle as putting it
// under its own ancestor.
async function descendantIds(rootId: string): Promise<Set<string>> {
  const children = await prisma.office.findMany({
    select: { id: true, parentId: true },
  });

  const childIdsByParent = new Map<string, string[]>();
  for (const row of children) {
    if (!row.parentId) continue;
    const list = childIdsByParent.get(row.parentId) ?? [];
    list.push(row.id);
    childIdsByParent.set(row.parentId, list);
  }

  const found = new Set<string>();
  const queue = [rootId];

  // The `seen` set also protects against a cycle that already exists in the
  // data, so a bad tree can never spin this into an infinite loop.
  const seen = new Set<string>([rootId]);
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const childId of childIdsByParent.get(current) ?? []) {
      if (seen.has(childId)) continue;
      seen.add(childId);
      found.add(childId);
      queue.push(childId);
    }
  }

  return found;
}

async function assertValidParent(officeId: string | null, parentId: string | null) {
  if (!parentId) return;

  const parent = await prisma.office.findUnique({ where: { id: parentId } });
  if (!parent) throw new AppError("Parent office not found", 404);

  if (officeId && parentId === officeId) {
    throw new AppError("An office cannot be its own parent", 400);
  }

  if (!officeId) return;

  const descendants = await descendantIds(officeId);
  if (descendants.has(parentId)) {
    throw new AppError(
      "Cannot move an office under one of its own sub-units — that would create a loop in the hierarchy",
      400,
    );
  }
}

export const officeService = {
  async list(includeArchived = false) {
    return prisma.office.findMany({
      where: includeArchived ? {} : { archivedAt: null },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { employees: true } },
        parent: { select: { id: true, name: true, code: true } },
      },
    });
  },

  // The full tree, for the org-chart view. Each node carries its own employee
  // count and scorecard summary so the UI can render the hierarchy without
  // walking back to the flat list.
  async tree(periodId?: string, allowedRootIds?: string[] | null) {
    const offices = await prisma.office.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { employees: true } },
        officeScorecards: {
          where: periodId ? { periodId } : {},
          select: {
            id: true,
            status: true,
            officeRating: true,
            totalScore: true,
            finalizedAt: true,
          },
          take: 1,
        },
      },
    });

    const byId = new Map<string, OfficeNode>();
    for (const o of offices) {
      const scorecard = o.officeScorecards[0];
      byId.set(o.id, {
        id: o.id,
        name: o.name,
        code: o.code,
        // Offices are the scored units; departments and sub-units are not
        // scored on their own.
        isScored: o.kind === "OFFICE",
        kind: o.kind,
        parentId: o.parentId,
        employeeCount: o._count.employees,
        // Filled in below once the tree is assembled.
        totalEmployeeCount: o._count.employees,
        scorecard: scorecard
          ? {
              id: scorecard.id,
              status: scorecard.status,
              officeRating: scorecard.officeRating,
              totalScore: scorecard.totalScore,
            }
          : null,
        children: [],
      });
    }

    const roots: OfficeNode[] = [];
    for (const node of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) {
        byId.get(node.parentId)!.children.push(node);
      } else {
        // Either a true root, or a child whose parent is archived/missing.
        // Surfacing it as a root keeps it reachable instead of vanishing.
        roots.push(node);
      }
    }

    // Root the chart at what the caller actually runs.
    //
    // The tree used to be returned whole and only the detail panel was scoped.
    // That leaked exactly what the panel withheld -- that a department exists,
    // how many people are in it, and where it sits.
    //
    // Scoping means *promoting* the allowed node to a root, not filtering the
    // root list: the department head's own node sits under OVP, so filtering
    // would leave them with an empty chart. It also means detaching it from its
    // parent, because leaving the parent link in place would reintroduce the
    // path above the caller that the scoping exists to hide.
    let allowed = roots;
    if (allowedRootIds) {
      allowed = [];
      for (const wanted of allowedRootIds) {
        let target: OfficeNode | undefined;
        for (const candidate of byId.values()) {
          if (candidate.id === wanted) {
            target = candidate;
            break;
          }
        }
        if (!target) continue;
        // Detach from the parent so nothing above this node is implied.
        if (target.parentId) {
          const parent = byId.get(target.parentId);
          if (parent) {
            parent.children = parent.children.filter((c) => c.id !== target.id);
          }
          target.parentId = null;
        }
        allowed.push(target);
      }
    }

    // Post-order walk so every node is summed after its children are done.
    const rollUp = (node: OfficeNode): number => {
      let total = node.employeeCount;
      for (const child of node.children) total += rollUp(child);
      node.totalEmployeeCount = total;
      return total;
    };
    for (const root of allowed) rollUp(root);

    return allowed;
  },

  async getById(id: string) {
    const office = await prisma.office.findUnique({
      where: { id },
      include: {
        employees: true,
        parent: { select: { id: true, name: true, code: true } },
        children: { select: { id: true, name: true, code: true, kind: true } },
      },
    });
    if (!office) throw new AppError("Office not found", 404);
    return office;
  },

  async create(data: CreateOfficeInput) {
    const existing = await prisma.office.findUnique({ where: { code: data.code } });
    if (existing) throw new AppError(`Office code "${data.code}" is already in use`, 409);

    await assertValidParent(null, data.parentId ?? null);

    return prisma.office.create({ data });
  },

  async update(id: string, data: UpdateOfficeInput) {
    await this.getById(id); // 404s if missing
    if (data.code) {
      const existing = await prisma.office.findUnique({ where: { code: data.code } });
      if (existing && existing.id !== id) {
        throw new AppError(`Office code "${data.code}" is already in use`, 409);
      }
    }
    if (data.parentId !== undefined) {
      await assertValidParent(id, data.parentId);
    }
    return prisma.office.update({ where: { id }, data });
  },

  async archive(id: string) {
    await this.getById(id);

    // Archiving a parent would orphan its whole subtree out of the tree view,
    // so refuse while any child office is still active.
    const activeChildren = await prisma.office.count({
      where: { parentId: id, archivedAt: null },
    });
    if (activeChildren > 0) {
      throw new AppError(
        `Cannot archive this office while ${activeChildren} sub-unit(s) are still active. Archive them first, or move them under another office.`,
        409,
      );
    }

    return prisma.office.update({ where: { id }, data: { archivedAt: new Date() } });
  },

  async unarchive(id: string) {
    await this.getById(id);
    return prisma.office.update({ where: { id }, data: { archivedAt: null } });
  },
};
