import { Router } from "express";
import chatRoutes from "./chat.routes.js";
import callsRoutes from "./calls.routes.js";

const router = Router();

router.use("/chat", chatRoutes);
router.use("/calls", callsRoutes);

export default router;
export { chatRoutes, callsRoutes };
