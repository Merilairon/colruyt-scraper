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
    process.env.AUTH0_ISSUER_BASE_URL || `https://${process.env.AUTH0_DOMAIN}`,
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

    // Handle userData creation with proper error handling for race conditions
    let userData;
    try {
      [userData] = await UserData.findOrCreate({
        where: { userId: user.id },
      });
    } catch (error: any) {
      // Handle potential race condition where concurrent requests try to create the same userData
      if (
        error.name === "SequelizeUniqueConstraintError" ||
        error.code === "23505"
      ) {
        // If we get a duplicate key error, try to find the existing record
        userData = await UserData.findOne({
          where: { userId: user.id },
        });
        if (!userData) {
          // If still not found, this is a genuine error
          throw error;
        }
      } else {
        // Re-throw other errors
        throw error;
      }
    }

    req.userRecord = { user, userData };
    next();
  } catch (error) {
    next(error);
  }
}
