var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  dealClicks: () => dealClicks,
  dealClicksRelations: () => dealClicksRelations,
  deals: () => deals,
  dealsRelations: () => dealsRelations,
  insertDealClickSchema: () => insertDealClickSchema,
  insertDealSchema: () => insertDealSchema,
  insertSocialShareSchema: () => insertSocialShareSchema,
  sessions: () => sessions,
  socialShares: () => socialShares,
  socialSharesRelations: () => socialSharesRelations,
  users: () => users
});
import { sql, relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull()
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var deals = pgTable("deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }).notNull(),
  salePrice: decimal("sale_price", { precision: 10, scale: 2 }).notNull(),
  discountPercentage: integer("discount_percentage").notNull(),
  imageUrl: text("image_url"),
  affiliateUrl: text("affiliate_url").notNull(),
  store: varchar("store").notNull(),
  storeLogoUrl: text("store_logo_url"),
  category: varchar("category").notNull(),
  rating: decimal("rating", { precision: 2, scale: 1 }),
  reviewCount: integer("review_count").default(0),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
  isAiApproved: boolean("is_ai_approved").default(false),
  aiScore: decimal("ai_score", { precision: 3, scale: 1 }),
  aiReasons: jsonb("ai_reasons"),
  popularity: integer("popularity").default(0),
  clickCount: integer("click_count").default(0),
  shareCount: integer("share_count").default(0),
  dealType: varchar("deal_type").notNull().default("latest"),
  // 'top', 'hot', 'latest'
  sourceApi: varchar("source_api"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var dealClicks = pgTable("deal_clicks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").notNull().references(() => deals.id),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  referrer: text("referrer"),
  clickedAt: timestamp("clicked_at").defaultNow()
});
var socialShares = pgTable("social_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").notNull().references(() => deals.id),
  platform: varchar("platform").notNull(),
  // 'facebook', 'twitter', 'whatsapp', 'copy'
  ipAddress: varchar("ip_address"),
  sharedAt: timestamp("shared_at").defaultNow()
});
var dealsRelations = relations(deals, ({ many }) => ({
  clicks: many(dealClicks),
  shares: many(socialShares)
}));
var dealClicksRelations = relations(dealClicks, ({ one }) => ({
  deal: one(deals, {
    fields: [dealClicks.dealId],
    references: [deals.id]
  })
}));
var socialSharesRelations = relations(socialShares, ({ one }) => ({
  deal: one(deals, {
    fields: [socialShares.dealId],
    references: [deals.id]
  })
}));
var insertDealSchema = createInsertSchema(deals).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertDealClickSchema = createInsertSchema(dealClicks).omit({
  id: true,
  clickedAt: true
});
var insertSocialShareSchema = createInsertSchema(socialShares).omit({
  id: true,
  sharedAt: true
});

// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle({ client: pool, schema: schema_exports });

// server/storage.ts
import { eq, desc, and, gte, sql as sql2 } from "drizzle-orm";
var DatabaseStorage = class {
  // User operations
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async upsertUser(userData) {
    const [user] = await db.insert(users).values(userData).onConflictDoUpdate({
      target: users.id,
      set: {
        ...userData,
        updatedAt: /* @__PURE__ */ new Date()
      }
    }).returning();
    return user;
  }
  // Deal operations
  async getDeals(limit = 50, category, dealType) {
    const whereConditions = [
      eq(deals.isActive, true),
      eq(deals.isAiApproved, true)
    ];
    if (category) {
      whereConditions.push(eq(deals.category, category));
    }
    if (dealType) {
      whereConditions.push(eq(deals.dealType, dealType));
    }
    return await db.select().from(deals).where(and(...whereConditions)).orderBy(desc(deals.popularity), desc(deals.createdAt)).limit(limit);
  }
  async getDealById(id) {
    const [deal] = await db.select().from(deals).where(eq(deals.id, id));
    return deal;
  }
  async createDeal(deal) {
    const [newDeal] = await db.insert(deals).values(deal).returning();
    return newDeal;
  }
  async updateDeal(id, deal) {
    const [updatedDeal] = await db.update(deals).set({ ...deal, updatedAt: /* @__PURE__ */ new Date() }).where(eq(deals.id, id)).returning();
    return updatedDeal;
  }
  async deleteDeal(id) {
    await db.delete(deals).where(eq(deals.id, id));
  }
  async getPendingDeals(limit = 20) {
    return await db.select().from(deals).where(and(eq(deals.isActive, true), eq(deals.isAiApproved, false))).orderBy(desc(deals.createdAt)).limit(limit);
  }
  async approveDeal(id) {
    const [deal] = await db.update(deals).set({ isAiApproved: true, updatedAt: /* @__PURE__ */ new Date() }).where(eq(deals.id, id)).returning();
    return deal;
  }
  async rejectDeal(id) {
    await db.update(deals).set({ isActive: false, updatedAt: /* @__PURE__ */ new Date() }).where(eq(deals.id, id));
  }
  async updateDealPopularity() {
    await db.execute(sql2`
      UPDATE deals 
      SET popularity = (click_count * 2 + share_count * 5)
      WHERE is_active = true AND is_ai_approved = true
    `);
  }
  // Analytics operations
  async trackDealClick(click) {
    const [newClick] = await db.insert(dealClicks).values(click).returning();
    await db.update(deals).set({
      clickCount: sql2`${deals.clickCount} + 1`,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(deals.id, click.dealId));
    return newClick;
  }
  async trackSocialShare(share) {
    const [newShare] = await db.insert(socialShares).values(share).returning();
    await db.update(deals).set({
      shareCount: sql2`${deals.shareCount} + 1`,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(deals.id, share.dealId));
    return newShare;
  }
  async getAnalytics() {
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    const [totalDealsResult] = await db.select({ count: sql2`count(*)` }).from(deals).where(eq(deals.isActive, true));
    const [aiApprovedResult] = await db.select({ count: sql2`count(*)` }).from(deals).where(and(eq(deals.isActive, true), eq(deals.isAiApproved, true)));
    const [pendingReviewResult] = await db.select({ count: sql2`count(*)` }).from(deals).where(and(eq(deals.isActive, true), eq(deals.isAiApproved, false)));
    const [clicksTodayResult] = await db.select({ count: sql2`count(*)` }).from(dealClicks).where(gte(dealClicks.clickedAt, today));
    return {
      totalDeals: totalDealsResult?.count || 0,
      aiApproved: aiApprovedResult?.count || 0,
      pendingReview: pendingReviewResult?.count || 0,
      clicksToday: clicksTodayResult?.count || 0
    };
  }
};
var storage = new DatabaseStorage();

// server/replitAuth.ts
import * as client from "openid-client";
import { Strategy } from "openid-client/passport";
import passport from "passport";
import session from "express-session";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}
var getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID
    );
  },
  { maxAge: 3600 * 1e3 }
);
function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1e3;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions"
  });
  return session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl
    }
  });
}
function updateUserSession(user, tokens) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}
async function upsertUser(claims) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"]
  });
}
async function setupAuth(app2) {
  app2.set("trust proxy", 1);
  app2.use(getSession());
  app2.use(passport.initialize());
  app2.use(passport.session());
  const config = await getOidcConfig();
  const verify = async (tokens, verified) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };
  for (const domain of process.env.REPLIT_DOMAINS.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`
      },
      verify
    );
    passport.use(strategy);
  }
  passport.serializeUser((user, cb) => cb(null, user));
  passport.deserializeUser((user, cb) => cb(null, user));
  app2.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"]
    })(req, res, next);
  });
  app2.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login"
    })(req, res, next);
  });
  app2.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`
        }).href
      );
    });
  });
}
var isAuthenticated = async (req, res, next) => {
  const user = req.user;
  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const now = Math.floor(Date.now() / 1e3);
  if (now <= user.expires_at) {
    return next();
  }
  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};

// server/services/aiService.ts
import OpenAI from "openai";
var openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "default_key"
});
var AIService = class {
  async validateDeal(deal) {
    try {
      console.log(`Validating deal: ${deal.title}`);
      const prompt = `
        Analyze this deal and provide a validation assessment in JSON format:

        Deal Details:
        - Title: ${deal.title}
        - Original Price: $${deal.originalPrice}
        - Sale Price: $${deal.salePrice}
        - Discount: ${deal.discountPercentage}%
        - Store: ${deal.store}
        - Category: ${deal.category}
        - Description: ${deal.description || "No description"}

        Please evaluate this deal and respond with JSON in this exact format:
        {
          "isValid": boolean,
          "score": number (0-10),
          "category": "electronics|fashion|home|travel|sports|beauty|other",
          "dealType": "top|hot|latest",
          "reasons": ["reason1", "reason2", ...],
          "suggestedTitle": "optional improved title if needed"
        }

        Evaluation criteria:
        - Score 0-3: Poor deal (fake discounts, overpriced, suspicious)
        - Score 4-6: Average deal (moderate savings, decent value)
        - Score 7-8: Good deal (significant savings, popular items)
        - Score 9-10: Excellent deal (exceptional savings, high-demand items)

        Deal type classification:
        - "top": Score 8+, popular categories, high discount %
        - "hot": Score 6+, trending items, time-sensitive
        - "latest": Score 4+, newly added deals

        Category classification should be accurate based on the product type.
      `;
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert deal validation AI that evaluates e-commerce deals for quality, authenticity, and value. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });
      const result = JSON.parse(response.choices[0].message.content || "{}");
      if (typeof result.isValid !== "boolean" || typeof result.score !== "number" || !["top", "hot", "latest"].includes(result.dealType)) {
        throw new Error("Invalid AI response structure");
      }
      return {
        isValid: result.isValid,
        score: Math.max(0, Math.min(10, result.score)),
        category: result.category || deal.category || "other",
        dealType: result.dealType,
        reasons: Array.isArray(result.reasons) ? result.reasons : [],
        suggestedTitle: result.suggestedTitle
      };
    } catch (error) {
      console.error("AI validation error:", error);
      const discountPercent = deal.discountPercentage || 0;
      let score = 5;
      let dealType = "latest";
      if (discountPercent >= 70) {
        score = 9;
        dealType = "top";
      } else if (discountPercent >= 50) {
        score = 7;
        dealType = "hot";
      } else if (discountPercent >= 30) {
        score = 6;
        dealType = "hot";
      }
      return {
        isValid: discountPercent >= 10 && score >= 4,
        score,
        category: deal.category || "other",
        dealType,
        reasons: ["Fallback validation due to AI service error"]
      };
    }
  }
  async categorizeDeal(title, description) {
    try {
      const prompt = `
        Categorize this product into one of these categories: electronics, fashion, home, travel, sports, beauty, automotive, books, toys, health, food, other.

        Product: ${title}
        Description: ${description || "No description"}

        Respond with JSON: {"category": "category_name"}
      `;
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      });
      const result = JSON.parse(response.choices[0].message.content || "{}");
      return result.category || "other";
    } catch (error) {
      console.error("AI categorization error:", error);
      return "other";
    }
  }
  async generateDealTitle(originalTitle, store, discount) {
    try {
      const prompt = `
        Improve this deal title to be more engaging and SEO-friendly while keeping it accurate and under 60 characters:

        Original: ${originalTitle}
        Store: ${store}
        Discount: ${discount}%

        Guidelines:
        - Include discount percentage
        - Make it compelling but not clickbait
        - Keep brand/product names accurate
        - Under 60 characters

        Respond with JSON: {"title": "improved_title"}
      `;
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.5
      });
      const result = JSON.parse(response.choices[0].message.content || "{}");
      return result.title || originalTitle;
    } catch (error) {
      console.error("AI title generation error:", error);
      return originalTitle;
    }
  }
};
var aiService = new AIService();

// server/services/dealService.ts
var DealService = class {
  async processDealSubmission(dealData) {
    try {
      if (!dealData.discountPercentage && dealData.originalPrice && dealData.salePrice) {
        const original = parseFloat(dealData.originalPrice.toString());
        const sale = parseFloat(dealData.salePrice.toString());
        dealData.discountPercentage = Math.round((original - sale) / original * 100);
      }
      const validation = await aiService.validateDeal(dealData);
      if (!validation.isValid) {
        return {
          success: false,
          message: `Deal rejected by AI: ${validation.reasons.join(", ")}`
        };
      }
      if (validation.suggestedTitle) {
        dealData.title = validation.suggestedTitle;
      }
      const autoApprove = validation.score >= 8.5;
      const deal = {
        title: dealData.title || "",
        description: dealData.description,
        originalPrice: dealData.originalPrice || "0",
        salePrice: dealData.salePrice || "0",
        discountPercentage: dealData.discountPercentage || 0,
        imageUrl: dealData.imageUrl,
        affiliateUrl: dealData.affiliateUrl || "",
        store: dealData.store || "",
        storeLogoUrl: dealData.storeLogoUrl,
        category: validation.category,
        rating: dealData.rating,
        reviewCount: dealData.reviewCount || 0,
        expiresAt: dealData.expiresAt,
        isActive: true,
        isAiApproved: autoApprove,
        aiScore: validation.score.toString(),
        aiReasons: validation.reasons,
        popularity: 0,
        clickCount: 0,
        shareCount: 0,
        dealType: validation.dealType,
        sourceApi: dealData.sourceApi || "manual"
      };
      const createdDeal = await storage.createDeal(deal);
      return {
        success: true,
        dealId: createdDeal.id,
        message: autoApprove ? "Deal approved and published" : "Deal submitted for review"
      };
    } catch (error) {
      console.error("Deal processing error:", error);
      return {
        success: false,
        message: "Failed to process deal submission"
      };
    }
  }
  async formatAffiliateUrl(url, dealId) {
    const urlObj = new URL(url);
    urlObj.searchParams.set("ref", "dealsphere");
    urlObj.searchParams.set("deal_id", dealId);
    return urlObj.toString();
  }
  async updateDealPopularity() {
    await storage.updateDealPopularity();
  }
  async getDealsAnalytics() {
    return await storage.getAnalytics();
  }
};
var dealService = new DealService();

// server/seedData.ts
var sampleDeals = [
  {
    title: "Echo Dot (5th Gen) Smart Speaker with Alexa - 65% Off",
    description: "Compact smart speaker with improved audio, LED display, and Alexa voice control. Perfect for any room.",
    originalPrice: "59.99",
    salePrice: "19.99",
    discountPercentage: 67,
    imageUrl: "https://images.unsplash.com/photo-1589492477829-5e65395b66cc?ixlib=rb-4.0.3&w=800&h=600&fit=crop",
    affiliateUrl: "https://amazon.com/echo-dot-5th-gen",
    store: "Amazon",
    storeLogoUrl: "https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?ixlib=rb-4.0.3&w=100&h=100&fit=crop",
    category: "electronics",
    rating: "4.7",
    reviewCount: 47821,
    sourceApi: "amazon_api"
  },
  {
    title: "Fire TV Stick 4K Max Streaming Device - 50% Off",
    description: "Stream 4K Ultra HD content with Wi-Fi 6 support, Alexa Voice Remote, and faster app starts.",
    originalPrice: "54.99",
    salePrice: "27.99",
    discountPercentage: 49,
    imageUrl: "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?ixlib=rb-4.0.3&w=800&h=600&fit=crop",
    affiliateUrl: "https://amazon.com/fire-tv-stick-4k-max",
    store: "Amazon",
    storeLogoUrl: "https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?ixlib=rb-4.0.3&w=100&h=100&fit=crop",
    category: "electronics",
    rating: "4.6",
    reviewCount: 231654,
    sourceApi: "amazon_api"
  },
  {
    title: "Kindle Paperwhite (11th Generation) - 32% Off",
    description: 'Waterproof e-reader with 6.8" display, adjustable warm light, and weeks of battery life.',
    originalPrice: "149.99",
    salePrice: "99.99",
    discountPercentage: 33,
    imageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?ixlib=rb-4.0.3&w=800&h=600&fit=crop",
    affiliateUrl: "https://amazon.com/kindle-paperwhite-11th-gen",
    store: "Amazon",
    storeLogoUrl: "https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?ixlib=rb-4.0.3&w=100&h=100&fit=crop",
    category: "electronics",
    rating: "4.5",
    reviewCount: 89432,
    sourceApi: "amazon_api"
  },
  {
    title: "Apple AirPods (3rd Generation) - 25% Off",
    description: "Spatial audio, sweat and water resistant, up to 30 hours of listening time with charging case.",
    originalPrice: "179.00",
    salePrice: "134.99",
    discountPercentage: 25,
    imageUrl: "https://images.unsplash.com/photo-1588423771073-b8903fbb85b5?ixlib=rb-4.0.3&w=800&h=600&fit=crop",
    affiliateUrl: "https://amazon.com/airpods-3rd-generation",
    store: "Amazon",
    storeLogoUrl: "https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?ixlib=rb-4.0.3&w=100&h=100&fit=crop",
    category: "electronics",
    rating: "4.4",
    reviewCount: 156789,
    sourceApi: "amazon_api"
  },
  {
    title: "Instant Vortex Plus 6 Quart Air Fryer - 43% Off",
    description: "6-in-1 air fryer with smart programs, crispy cooking technology, and easy cleanup.",
    originalPrice: "139.99",
    salePrice: "79.99",
    discountPercentage: 43,
    imageUrl: "https://images.unsplash.com/photo-1585515656798-f4da54d7c3bf?ixlib=rb-4.0.3&w=800&h=600&fit=crop",
    affiliateUrl: "https://amazon.com/instant-vortex-plus-air-fryer",
    store: "Amazon",
    storeLogoUrl: "https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?ixlib=rb-4.0.3&w=100&h=100&fit=crop",
    category: "home",
    rating: "4.3",
    reviewCount: 23876,
    sourceApi: "amazon_api"
  },
  {
    title: "Anker Portable Charger 10000mAh - 38% Off",
    description: "Ultra-compact power bank with fast charging, multiple device support, and LED indicators.",
    originalPrice: "39.99",
    salePrice: "24.99",
    discountPercentage: 38,
    imageUrl: "https://images.unsplash.com/photo-1609392133730-ba3779e5b304?ixlib=rb-4.0.3&w=800&h=600&fit=crop",
    affiliateUrl: "https://amazon.com/anker-portable-charger-10000",
    store: "Amazon",
    storeLogoUrl: "https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?ixlib=rb-4.0.3&w=100&h=100&fit=crop",
    category: "electronics",
    rating: "4.6",
    reviewCount: 145632,
    sourceApi: "amazon_api"
  },
  {
    title: "Levi's 501 Original Fit Jeans - 35% Off",
    description: "Classic straight fit jeans with button fly, made from premium cotton denim.",
    originalPrice: "69.50",
    salePrice: "44.99",
    discountPercentage: 35,
    imageUrl: "https://images.unsplash.com/photo-1542272604-787c3835535d?ixlib=rb-4.0.3&w=800&h=600&fit=crop",
    affiliateUrl: "https://amazon.com/levis-501-original-fit-jeans",
    store: "Amazon",
    storeLogoUrl: "https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?ixlib=rb-4.0.3&w=100&h=100&fit=crop",
    category: "fashion",
    rating: "4.2",
    reviewCount: 8934,
    sourceApi: "amazon_api"
  },
  {
    title: 'Samsung 55" Crystal UHD 4K Smart TV - 47% Off',
    description: "Crystal UHD processor, HDR support, Tizen OS with built-in streaming apps, and voice control.",
    originalPrice: "649.99",
    salePrice: "344.99",
    discountPercentage: 47,
    imageUrl: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?ixlib=rb-4.0.3&w=800&h=600&fit=crop",
    affiliateUrl: "https://amazon.com/samsung-55-crystal-uhd-4k",
    store: "Amazon",
    storeLogoUrl: "https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?ixlib=rb-4.0.3&w=100&h=100&fit=crop",
    category: "electronics",
    rating: "4.5",
    reviewCount: 12847,
    sourceApi: "amazon_api"
  },
  {
    title: "Ninja Foodi Personal Blender - 41% Off",
    description: "Personal-sized blender with nutrient extraction, 18 oz cup, and easy cleaning.",
    originalPrice: "79.99",
    salePrice: "46.99",
    discountPercentage: 41,
    imageUrl: "https://images.unsplash.com/photo-1570197788417-0e82375c9371?ixlib=rb-4.0.3&w=800&h=600&fit=crop",
    affiliateUrl: "https://amazon.com/ninja-foodi-personal-blender",
    store: "Amazon",
    storeLogoUrl: "https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?ixlib=rb-4.0.3&w=100&h=100&fit=crop",
    category: "home",
    rating: "4.4",
    reviewCount: 7654,
    sourceApi: "amazon_api"
  },
  {
    title: "Carhartt Men's Acrylic Watch Hat - 29% Off",
    description: "Classic knit beanie made from soft acrylic yarn, perfect for cold weather.",
    originalPrice: "16.99",
    salePrice: "11.99",
    discountPercentage: 29,
    imageUrl: "https://images.unsplash.com/photo-1521369909029-2afed882baee?ixlib=rb-4.0.3&w=800&h=600&fit=crop",
    affiliateUrl: "https://amazon.com/carhartt-acrylic-watch-hat",
    store: "Amazon",
    storeLogoUrl: "https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?ixlib=rb-4.0.3&w=100&h=100&fit=crop",
    category: "fashion",
    rating: "4.6",
    reviewCount: 45123,
    sourceApi: "amazon_api"
  },
  {
    title: "Dyson V15 Detect Cordless Vacuum - 35% Off",
    description: "Advanced cordless vacuum with laser dust detection and powerful suction for all floor types.",
    originalPrice: "750.00",
    salePrice: "487.50",
    discountPercentage: 35,
    imageUrl: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?ixlib=rb-4.0.3&w=800&h=600&fit=crop",
    affiliateUrl: "https://dyson.com/v15-detect",
    store: "Dyson",
    storeLogoUrl: "https://images.unsplash.com/photo-1586953983027-d7508a64f4bb?ixlib=rb-4.0.3&w=100&h=100&fit=crop",
    category: "home",
    rating: "4.9",
    reviewCount: 567,
    sourceApi: "dyson_api"
  },
  {
    title: "Instant Pot Duo 7-in-1 Electric Pressure Cooker - 50% Off",
    description: "Multi-functional pressure cooker that combines 7 kitchen appliances in one. Perfect for quick meals.",
    originalPrice: "99.99",
    salePrice: "49.99",
    discountPercentage: 50,
    imageUrl: "https://images.unsplash.com/photo-1556909114-2b522d8deb8d?ixlib=rb-4.0.3&w=800&h=600&fit=crop",
    affiliateUrl: "https://instantpot.com/duo-7-in-1",
    store: "Target",
    storeLogoUrl: "https://images.unsplash.com/photo-1596464716127-f2a82984de30?ixlib=rb-4.0.3&w=100&h=100&fit=crop",
    category: "home",
    rating: "4.5",
    reviewCount: 3421,
    sourceApi: "target_api"
  },
  {
    title: "AirPods Pro 2nd Generation - 30% Off Apple Store",
    description: "Active Noise Cancellation, Adaptive Transparency, and spatial audio with dynamic head tracking.",
    originalPrice: "249.00",
    salePrice: "174.30",
    discountPercentage: 30,
    imageUrl: "https://images.unsplash.com/photo-1588423771073-b8903fbb85b5?ixlib=rb-4.0.3&w=800&h=600&fit=crop",
    affiliateUrl: "https://apple.com/airpods-pro",
    store: "Apple",
    storeLogoUrl: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?ixlib=rb-4.0.3&w=100&h=100&fit=crop",
    category: "electronics",
    rating: "4.8",
    reviewCount: 1876,
    sourceApi: "apple_api"
  }
];
async function seedDeals() {
  console.log("Seeding sample deals...");
  for (const dealData of sampleDeals) {
    try {
      const result = await dealService.processDealSubmission(dealData);
      console.log(`Deal processed: ${dealData.title} - ${result.success ? "Success" : "Failed"}`);
    } catch (error) {
      console.error(`Failed to process deal: ${dealData.title}`, error);
    }
  }
  console.log("Finished seeding deals.");
}

// server/routes.ts
async function registerRoutes(app2) {
  await setupAuth(app2);
  app2.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  app2.get("/api/deals", async (req, res) => {
    try {
      const { limit, category, dealType } = req.query;
      const deals2 = await storage.getDeals(
        limit ? parseInt(limit) : void 0,
        category,
        dealType
      );
      res.json(deals2);
    } catch (error) {
      console.error("Error fetching deals:", error);
      res.status(500).json({ message: "Failed to fetch deals" });
    }
  });
  app2.get("/api/deals/:id", async (req, res) => {
    try {
      const deal = await storage.getDealById(req.params.id);
      if (!deal) {
        return res.status(404).json({ message: "Deal not found" });
      }
      res.json(deal);
    } catch (error) {
      console.error("Error fetching deal:", error);
      res.status(500).json({ message: "Failed to fetch deal" });
    }
  });
  app2.post("/api/deals/:id/click", async (req, res) => {
    try {
      const clickData = insertDealClickSchema.parse({
        dealId: req.params.id,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        referrer: req.get("Referer")
      });
      await storage.trackDealClick(clickData);
      const deal = await storage.getDealById(req.params.id);
      if (!deal) {
        return res.status(404).json({ message: "Deal not found" });
      }
      const affiliateUrl = await dealService.formatAffiliateUrl(deal.affiliateUrl, deal.id);
      res.json({ affiliateUrl });
    } catch (error) {
      console.error("Error tracking click:", error);
      res.status(500).json({ message: "Failed to track click" });
    }
  });
  app2.post("/api/deals/:id/share", async (req, res) => {
    try {
      const shareData = insertSocialShareSchema.parse({
        dealId: req.params.id,
        platform: req.body.platform,
        ipAddress: req.ip
      });
      await storage.trackSocialShare(shareData);
      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking share:", error);
      res.status(500).json({ message: "Failed to track share" });
    }
  });
  app2.get("/api/admin/deals/pending", isAuthenticated, async (req, res) => {
    try {
      const deals2 = await storage.getPendingDeals();
      res.json(deals2);
    } catch (error) {
      console.error("Error fetching pending deals:", error);
      res.status(500).json({ message: "Failed to fetch pending deals" });
    }
  });
  app2.post("/api/admin/deals/:id/approve", isAuthenticated, async (req, res) => {
    try {
      const deal = await storage.approveDeal(req.params.id);
      res.json(deal);
    } catch (error) {
      console.error("Error approving deal:", error);
      res.status(500).json({ message: "Failed to approve deal" });
    }
  });
  app2.post("/api/admin/deals/:id/reject", isAuthenticated, async (req, res) => {
    try {
      await storage.rejectDeal(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error rejecting deal:", error);
      res.status(500).json({ message: "Failed to reject deal" });
    }
  });
  app2.post("/api/admin/deals", isAuthenticated, async (req, res) => {
    try {
      const dealData = insertDealSchema.parse(req.body);
      const result = await dealService.processDealSubmission(dealData);
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error creating deal:", error);
      res.status(500).json({ message: "Failed to create deal" });
    }
  });
  app2.get("/api/admin/analytics", isAuthenticated, async (req, res) => {
    try {
      const analytics = await dealService.getDealsAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });
  app2.post("/api/admin/update-popularity", isAuthenticated, async (req, res) => {
    try {
      await dealService.updateDealPopularity();
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating popularity:", error);
      res.status(500).json({ message: "Failed to update popularity" });
    }
  });
  app2.post("/api/seed-deals", async (req, res) => {
    try {
      console.log("Starting to seed deals...");
      await seedDeals();
      console.log("Deals seeded successfully");
      res.json({ success: true, message: "Sample deals seeded successfully" });
    } catch (error) {
      console.error("Error seeding deals:", error);
      res.status(500).json({ message: "Failed to seed deals", error: error.message });
    }
  });
  app2.post("/api/quick-seed", async (req, res) => {
    try {
      console.log("Quick seeding deals without AI validation...");
      const deals2 = [
        {
          title: "Echo Dot (5th Gen) Smart Speaker with Alexa",
          description: "Compact smart speaker with improved audio, LED display, and Alexa voice control. Perfect for any room.",
          originalPrice: "59.99",
          salePrice: "19.99",
          discountPercentage: 67,
          imageUrl: "https://images.unsplash.com/photo-1589492477829-5e65395b66cc?ixlib=rb-4.0.3&w=800&h=600&fit=crop",
          affiliateUrl: "https://amazon.com/echo-dot-5th-gen",
          store: "Amazon",
          storeLogoUrl: "https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?ixlib=rb-4.0.3&w=100&h=100&fit=crop",
          category: "electronics",
          rating: "4.7",
          reviewCount: 47821,
          sourceApi: "amazon_api",
          status: "approved",
          aiScore: 9.2,
          dealType: "top",
          isActive: true,
          isAiApproved: true
        },
        {
          title: "Fire TV Stick 4K Max Streaming Device",
          description: "Stream 4K Ultra HD content with Wi-Fi 6 support, Alexa Voice Remote, and faster app starts.",
          originalPrice: "54.99",
          salePrice: "27.99",
          discountPercentage: 49,
          imageUrl: "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?ixlib=rb-4.0.3&w=800&h=600&fit=crop",
          affiliateUrl: "https://amazon.com/fire-tv-stick-4k-max",
          store: "Amazon",
          storeLogoUrl: "https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?ixlib=rb-4.0.3&w=100&h=100&fit=crop",
          category: "electronics",
          rating: "4.6",
          reviewCount: 231654,
          sourceApi: "amazon_api",
          status: "approved",
          aiScore: 8.8,
          dealType: "hot",
          isActive: true,
          isAiApproved: true
        }
      ];
      for (const deal of deals2) {
        await storage.createDeal(deal);
        console.log(`Added deal: ${deal.title}`);
      }
      res.json({ success: true, message: "Quick deals added successfully" });
    } catch (error) {
      console.error("Error quick seeding deals:", error);
      res.status(500).json({ message: "Failed to quick seed deals", error: error.message });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
