import { Router } from "express";
import vendorRoutes from "./vendor.routes.js";
import vendorsRoutes from "./vendors.routes.js";

const router = Router();

router.use("/vendor", vendorRoutes);
router.use("/vendors", vendorsRoutes);

export default router;
export { vendorRoutes, vendorsRoutes };
