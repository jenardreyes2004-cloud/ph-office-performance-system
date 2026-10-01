import { Router } from "express";

import { accountController } from "@/controllers/account.controller";
import { authenticate } from "@/middleware/authMiddleware";
import { requireRole } from "@/middleware/roleMiddleware";

export const accountRouter = Router();

accountRouter.use(authenticate);

/**
 * Accounts are the systems function, so the IT admin is the operator here --
 * that is what "IT Admin = accounts, database, config" means in practice. The
 * super admin can read and write them too.
 *
 * This gate is deliberately the *only* gate on the router. It says who may
 * reach the endpoints; `lib/accountGuard` then decides which of them they may
 * actually do. One role check and one authority check, rather than trying to
 * express authority in role names -- an IT admin and a Department Head share
 * no role, but the guard reasons about what they actually control.
 *
 * An office admin or a plain employee gets 403 on all of it.
 */
accountRouter.use(requireRole("IT_ADMIN", "MAIN_ADMIN"));

accountRouter.get("/", accountController.list);
accountRouter.get("/:id", accountController.getById);

accountRouter.post("/", accountController.create);

/** Name, email and password. Authority is not changeable through this one. */
accountRouter.patch("/:id", accountController.update);

/**
 * Role and activation get their own endpoints so each carries its own guard
 * reason. A shared "update everything" route is the obvious place for someone
 * to reach when they want more power, which is why it does not exist.
 */
accountRouter.patch("/:id/role", accountController.changeRole);
accountRouter.post("/:id/deactivate", accountController.deactivate);
accountRouter.post("/:id/reactivate", accountController.reactivate);