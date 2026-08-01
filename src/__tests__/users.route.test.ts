jest.mock("auth0", () => ({
  ManagementClient: jest.fn().mockImplementation(() => ({
    users: {
      update: jest.fn().mockResolvedValue({}),
    },
  })),
}));

const mockCheckJwt = jest.fn((req, res, next) => next());
const mockRequireUser = jest.fn(async (req, res, next) => {
  const auth = (req as any).auth;
  const payload = auth?.payload || {
    sub: "auth0|test-user",
    email: "test@example.com",
  };
  (req as any).userRecord = {
    user: {
      id: 1,
      auth0Id: payload.sub,
      email: payload.email || "test@example.com",
      displayName: null,
      locale: null,
      changed: jest.fn(() => false),
      save: jest.fn().mockResolvedValue(undefined),
    },
    userData: {
      userId: 1,
      shoppingList: [],
      favourites: [],
      filters: [
        {
          filterName: "-100% to -50%",
          fromPercentage: -100,
          toPercentage: -50,
        },
      ],
      save: jest.fn().mockResolvedValue(undefined),
    },
  };
  next();
});

jest.mock("../middleware/auth", () => ({
  checkJwt: mockCheckJwt,
  requireUser: mockRequireUser,
}));

import express from "express";
import request from "supertest";
import userRouter from "../routes/users";

function buildApp(userRecordOverride?: any) {
  const app = express();
  app.use(express.json());
  if (userRecordOverride) {
    app.use((req, res, next) => {
      (req as any).userRecord = userRecordOverride;
      next();
    });
  }
  app.use("/api/me", userRouter);
  return app;
}

describe("GET /api/me", () => {
  it("returns the authenticated user's profile and data", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(200);
    expect(res.body.auth0Id).toBe("auth0|test-user");
    expect(res.body).toHaveProperty("shoppingList");
    expect(res.body).toHaveProperty("favourites");
    expect(res.body).toHaveProperty("filters");
  });
});

describe("PATCH /api/me", () => {
  it("updates local profile fields", async () => {
    const app = buildApp();
    const res = await request(app).patch("/api/me").send({
      displayName: "Test User",
      locale: "en",
    });
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe("Test User");
    expect(res.body.locale).toBe("en");
  });

  it("delegates email and password updates to Auth0", async () => {
    const { ManagementClient } = require("auth0");
    const app = buildApp();
    const res = await request(app).patch("/api/me").send({
      email: "new@example.com",
      password: "newPassword123",
    });
    expect(res.status).toBe(200);
    const instance = ManagementClient.mock.results[0].value;
    expect(instance.users.update).toHaveBeenCalledWith("auth0|test-user", {
      email: "new@example.com",
      password: "newPassword123",
    });
  });
});

describe("PUT /api/me/shopping-list", () => {
  it("replaces and validates the shopping list", async () => {
    const app = buildApp();
    const res = await request(app)
      .put("/api/me/shopping-list")
      .send([
        { productId: "123", quantity: 2 },
        { productId: "123", quantity: 3 },
        { productId: "456", quantity: 0 },
      ]);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ productId: "123", quantity: 5 }]);
  });

  it("rejects an invalid shopping list", async () => {
    const app = buildApp();
    const res = await request(app)
      .put("/api/me/shopping-list")
      .send([{ productId: "123" }]);
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/me/favourites", () => {
  it("replaces and deduplicates favourites", async () => {
    const app = buildApp();
    const res = await request(app)
      .put("/api/me/favourites")
      .send(["123", "123", "456"]);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(["123", "456"]);
  });

  it("rejects non-string favourites", async () => {
    const app = buildApp();
    const res = await request(app).put("/api/me/favourites").send([123]);
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/me/filters", () => {
  it("replaces valid filters", async () => {
    const app = buildApp();
    const res = await request(app)
      .put("/api/me/filters")
      .send([
        { filterName: "Big drops", fromPercentage: -100, toPercentage: -50 },
        { filterName: "Fruit", category: "Fruits" },
      ]);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("rejects filters with both category and percentages", async () => {
    const app = buildApp();
    const res = await request(app)
      .put("/api/me/filters")
      .send([
        {
          filterName: "Bad",
          category: "Fruits",
          fromPercentage: -100,
          toPercentage: -50,
        },
      ]);
    expect(res.status).toBe(400);
  });

  it("rejects filters where fromPercentage > toPercentage", async () => {
    const app = buildApp();
    const res = await request(app)
      .put("/api/me/filters")
      .send([{ filterName: "Bad", fromPercentage: -50, toPercentage: -100 }]);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/me/{shopping-list,favourites,filters}", () => {
  it("returns the current user's data sections", async () => {
    const app = buildApp();
    const shopping = await request(app).get("/api/me/shopping-list");
    expect(shopping.status).toBe(200);
    expect(Array.isArray(shopping.body)).toBe(true);

    const favs = await request(app).get("/api/me/favourites");
    expect(favs.status).toBe(200);
    expect(Array.isArray(favs.body)).toBe(true);

    const filters = await request(app).get("/api/me/filters");
    expect(filters.status).toBe(200);
    expect(Array.isArray(filters.body)).toBe(true);
  });
});
