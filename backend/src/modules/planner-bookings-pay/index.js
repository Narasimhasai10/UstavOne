import { Router } from "express";
import plannerRoutes from "./planner.routes.js";
import bookingsRoutes from "./bookings.routes.js";
import paymentsRoutes from "./payments.routes.js";

const router = Router();

router.use("/planner", plannerRoutes);
router.use("/bookings", bookingsRoutes);
router.use("/payments", paymentsRoutes);

export default router;
export { plannerRoutes, bookingsRoutes, paymentsRoutes };
