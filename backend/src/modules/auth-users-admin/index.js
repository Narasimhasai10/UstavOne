import { Router } from "express";
import publicRoutes from "./public.routes.js";
import authRoutes from "./auth.routes.js";
import adminRoutes from "./admin.routes.js";
import notificationsRoutes from "./notifications.routes.js";

const router = Router();

router.use("/public", publicRoutes);
router.use("/", publicRoutes);
router.use("/auth", authRoutes);
router.post("/vendor/login", (req, res, next) => {
  req.url = "/vendor/login";
  authRoutes(req, res, next);
});
router.post("/user/login", (req, res, next) => {
  req.url = "/user/login";
  authRoutes(req, res, next);
});
router.post("/user/signup", (req, res, next) => {
  req.url = "/user/signup";
  authRoutes(req, res, next);
});
router.use("/admin", adminRoutes);
router.use("/notifications", notificationsRoutes);

export default router;
export { publicRoutes, authRoutes, adminRoutes, notificationsRoutes };
