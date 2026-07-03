import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireAdmin } from "../auth.js";

const router = Router();
router.use(requireAuth, requireAdmin);

// GET /admin/feedback — every candidate's experience feedback (admin only).
router.get("/feedback", async (_req, res) => {
  const rows = await prisma.experienceFeedback.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      session: {
        select: {
          interviewType: true,
          startedAt: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  const feedback = rows.map((f) => ({
    id: f.id,
    rating: f.rating,
    aiComment: f.aiComment,
    techIssues: f.techIssues,
    comments: f.comments,
    createdAt: f.createdAt,
    interviewType: f.session.interviewType,
    candidateName: f.session.user.name,
    candidateEmail: f.session.user.email,
  }));

  res.json({ feedback });
});

export default router;
