import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

// The single admin who can review experience feedback. Set ADMIN_EMAIL to the
// email you log into the app with. Compared case-insensitively.
export function isAdminEmail(email) {
  const admin = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  return !!admin && (email || "").trim().toLowerCase() === admin;
}

export function signToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// Express middleware: reads the Bearer token, attaches req.userId + req.userEmail.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Gate for admin-only routes. Must be used after requireAuth.
export function requireAdmin(req, res, next) {
  if (!isAdminEmail(req.userEmail)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
