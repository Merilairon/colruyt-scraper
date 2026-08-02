import { Router, Response } from "express";
import { ManagementClient } from "auth0";
import type {
  UserData,
  ShoppingListItem,
  ChangeFilter,
} from "../models/UserData";
import {
  AuthenticatedRequest,
  checkJwt,
  requireUser,
} from "../middleware/auth";

const router = Router();

const managementClient = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN || "",
  clientId: process.env.AUTH0_CLIENT_ID || "",
  clientSecret: process.env.AUTH0_CLIENT_SECRET || "",
  audience:
    process.env.AUTH0_MANAGEMENT_AUDIENCE ||
    `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
});

router.use(checkJwt);
router.use(requireUser);

function getUserData(req: AuthenticatedRequest): UserData {
  return req.userRecord!.userData;
}

function getUser(req: AuthenticatedRequest) {
  return req.userRecord!.user;
}

function respondWithUser(req: AuthenticatedRequest, res: Response) {
  const user = getUser(req);
  const userData = getUserData(req);
  res.json({
    id: user.id,
    auth0Id: user.auth0Id,
    email: user.email,
    displayName: user.displayName,
    locale: user.locale,
    shoppingList: userData.shoppingList,
    favourites: userData.favourites,
    filters: userData.filters,
  });
}

/**
 * GET /api/me
 * Returns the authenticated user's profile and stored data.
 */
router.get("/", (req: AuthenticatedRequest, res: Response) => {
  respondWithUser(req, res);
});

/**
 * DELETE /api/me
 * Deletes the authenticated user's Auth0 account and local records.
 * Requires the client to send `{"confirm": "DELETE"}` as a safety guard.
 */
router.delete("/", async (req: AuthenticatedRequest, res, next) => {
  const { confirm } = req.body;
  if (confirm !== "DELETE") {
    res
      .status(400)
      .json({ message: "Send { confirm: 'DELETE' } to delete your account" });
    return;
  }

  try {
    const user = getUser(req);
    await managementClient.users.delete(user.auth0Id);
    await user.destroy();
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/me
 * Updates local profile fields and optionally delegates email/password
 * changes to Auth0 via the Management API.
 */
router.patch("/", async (req: AuthenticatedRequest, res, next) => {
  const { displayName, locale, email, password } = req.body;
  const user = getUser(req);
  let updatedInAuth0 = false;

  try {
    if (email || password) {
      await managementClient.users.update(user.auth0Id, {
        ...(email && { email }),
        ...(password && { password }),
      });
      if (email) user.email = email;
      updatedInAuth0 = true;
    }

    if (displayName !== undefined) user.displayName = displayName;
    if (locale !== undefined) user.locale = locale;

    if (user.changed()) await user.save();

    respondWithUser(req, res);
  } catch (error) {
    next(error);
  }
});

function validateShoppingList(input: unknown): ShoppingListItem[] {
  if (!Array.isArray(input)) {
    throw new Error("shoppingList must be an array");
  }

  const merged = new Map<string, number>();
  for (const item of input) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as any).productId !== "string" ||
      typeof (item as any).quantity !== "number"
    ) {
      throw new Error(
        "Each shoppingList item must have a productId string and quantity number",
      );
    }

    const qty = Math.floor((item as any).quantity);
    if (qty <= 0) continue;
    const productId = (item as any).productId;
    merged.set(productId, (merged.get(productId) || 0) + qty);
  }

  return Array.from(merged.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

function validateFavourites(input: unknown): string[] {
  if (!Array.isArray(input)) {
    throw new Error("favourites must be an array");
  }
  if (!input.every((id) => typeof id === "string")) {
    throw new Error("favourites must be an array of strings");
  }
  return Array.from(new Set(input));
}

function validateFilters(input: unknown): ChangeFilter[] {
  if (!Array.isArray(input)) {
    throw new Error("filters must be an array");
  }

  const names = new Set<string>();
  return input.map((entry) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof (entry as any).filterName !== "string"
    ) {
      throw new Error("Each filter must have a filterName string");
    }

    if (names.has((entry as any).filterName)) {
      throw new Error(`Duplicate filterName: ${(entry as any).filterName}`);
    }
    names.add((entry as any).filterName);

    const filter: ChangeFilter = { filterName: (entry as any).filterName };

    const hasCategory = (entry as any).category !== undefined;
    const hasFrom = (entry as any).fromPercentage !== undefined;
    const hasTo = (entry as any).toPercentage !== undefined;

    if (hasCategory && (hasFrom || hasTo)) {
      throw new Error(
        "A filter cannot contain both category and percentage fields",
      );
    }

    if (hasCategory) {
      if (typeof (entry as any).category !== "string") {
        throw new Error("category must be a string");
      }
      filter.category = (entry as any).category;
    } else {
      if (hasFrom) {
        if (typeof (entry as any).fromPercentage !== "number") {
          throw new Error("fromPercentage must be a number");
        }
        filter.fromPercentage = (entry as any).fromPercentage;
      }
      if (hasTo) {
        if (typeof (entry as any).toPercentage !== "number") {
          throw new Error("toPercentage must be a number");
        }
        filter.toPercentage = (entry as any).toPercentage;
      }
      if (
        filter.fromPercentage !== undefined &&
        filter.toPercentage !== undefined &&
        filter.fromPercentage > filter.toPercentage
      ) {
        throw new Error(
          "fromPercentage must be less than or equal to toPercentage",
        );
      }
    }

    return filter;
  });
}

/**
 * GET /api/me/shopping-list
 */
router.get("/shopping-list", (req: AuthenticatedRequest, res: Response) => {
  res.json(getUserData(req).shoppingList);
});

/**
 * PUT /api/me/shopping-list
 */
router.put("/shopping-list", async (req: AuthenticatedRequest, res, next) => {
  try {
    const shoppingList = validateShoppingList(req.body);
    const userData = getUserData(req);
    userData.shoppingList = shoppingList;
    await userData.save();
    res.json(userData.shoppingList);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

/**
 * GET /api/me/favourites
 */
router.get("/favourites", (req: AuthenticatedRequest, res: Response) => {
  res.json(getUserData(req).favourites);
});

/**
 * PUT /api/me/favourites
 */
router.put("/favourites", async (req: AuthenticatedRequest, res, next) => {
  try {
    const favourites = validateFavourites(req.body);
    const userData = getUserData(req);
    userData.favourites = favourites;
    await userData.save();
    res.json(userData.favourites);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

/**
 * GET /api/me/filters
 */
router.get("/filters", (req: AuthenticatedRequest, res: Response) => {
  res.json(getUserData(req).filters);
});

/**
 * PUT /api/me/filters
 */
router.put("/filters", async (req: AuthenticatedRequest, res, next) => {
  try {
    const filters = validateFilters(req.body);
    const userData = getUserData(req);
    userData.filters = filters;
    await userData.save();
    res.json(userData.filters);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

export default router;
