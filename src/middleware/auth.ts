import { Request, Response, NextFunction } from "express";
import { auth } from "express-oauth2-jwt-bearer";
import { User } from "../models/User";
import { UserData } from "../models/UserData";

export interface AuthenticatedRequest extends Request {
  userRecord?: {
    user: User;
    userData: UserData;
  };
}

export const checkJwt = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL:
    process.env.AUTH0_ISSUER_BASE_URL ||
    `https://${process.env.AUTH0_DOMAIN}`,
  tokenSigningAlg: "RS256",
});

export async function requireUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const payload = req.auth?.payload;
  const sub = payload?.sub;
  if (!sub) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const auth0Id = sub as string;
    const email = (payload.email as string) || "";

    let [user] = await User.findOrCreate({
      where: { auth0Id },
      defaults: { email },
    });

    if (email && user.email !== email) {
      user.email = email;
      await user.save();
    }

    let userData = await UserData.findOne({ where: { userId: user.id } });
    if (!userData) {
      userData = await UserData.create({ userId: user.id });
    }

    req.userRecord = { user, userData };
    next();
  } catch (error) {
    next(error);
  }
}
