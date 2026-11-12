import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  or,
  sql,
} from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  AskHelpBody,
  AskHelpResponse,
  ConfirmOrderReceiptParams,
  ConfirmOrderReceiptResponse,
  CreateConversationBody,
  CreateConversationResponse,
  CreateListingBody,
  CreateListingResponse,
  CreateOrderBody,
  CreateOrderResponse,
  GetListingParams,
  GetListingResponse,
  GetWalletResponse,
  ListCategoriesResponse,
  ListConversationsResponse,
  ListListingsQueryParams,
  ListListingsResponse,
  ListMessagesParams,
  ListMessagesResponse,
  ListOrdersResponse,
  PayOrderBalanceBody,
  PayOrderBalanceParams,
  PayOrderBalanceResponse,
  PayOrderDepositBody,
  PayOrderDepositParams,
  PayOrderDepositResponse,
  RequestWithdrawalBody,
  RequestWithdrawalResponse,
  SendMessageBody,
  SendMessageParams,
  SendMessageResponse,
  UpdateListingBody,
  UpdateListingParams,
  UpdateListingResponse,
} from "@workspace/api-zod";
import { db, conversationsTable, listingsTable, messagesTable, ordersTable, walletTransactionsTable } from "@workspace/db";
import { requireUser, userIdFromRequest } from "../lib/auth";
import { memberDisplayName } from "../lib/member-display-name";
import { ObjectStorageService } from "../lib/objectStorage";
import { ownsUpload } from "../lib/upload-ownership";
import { createPhotoAssistantRouter } from "./photo-assistant";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();
class InventoryAllocationError extends Error {}

const categories = [
  { id: "tiles", nameEn: "Tiles & ceramics", nameAr: "بلاط وسيراميك" },
  { id: "building-materials", nameEn: "Cement & building materials", nameAr: "أسمنت ومواد بناء" },
  { id: "rebar", nameEn: "Reinforcing steel", nameAr: "حديد تسليح" },
  { id: "timber", nameEn: "Timber", nameAr: "أخشاب" },
  { id: "paint", nameEn: "Paints & fillers", nameAr: "دهانات ومعاجين" },
  { id: "insulation", nameEn: "Insulation & waterproofing", nameAr: "عوازل" },
  { id: "sanitary", nameEn: "Sanitary fixtures", nameAr: "أدوات صحية" },
  { id: "plumbing", nameEn: "Plumbing & pipes", nameAr: "سباكة ومواسير" },
  { id: "electrical", nameEn: "Electrical & lighting", nameAr: "كهرباء وإنارة" },
  { id: "doors-windows", nameEn: "Doors & windows", nameAr: "أبواب ونوافذ" },
  { id: "stone", nameEn: "Marble & granite", nameAr: "رخام وجرانيت" },
  { id: "gypsum", nameEn: "Gypsum & ceilings", nameAr: "جبس وأسقف" },
  { id: "tools", nameEn: "Tools & equipment", nameAr: "أدوات ومعدات" },
  { id: "misc", nameEn: "Miscellaneous", nameAr: "متفرقات" },
] as const;

const categoryById = new Map<string, (typeof categories)[number]>(
  categories.map((category) => [category.id, category]),
);

const sampleListings = [
  {
    id: "sample-beige-tiles",
    sellerId: "baqi-sample-seller-1",
    sellerName: "Baqi sample seller",
    sellerTrusted: true,
    title: "Beige 60 × 60 cm porcelain tiles",
    description: "Surplus from a recent renovation. Clean boxed stock, 1.44 m² per box.",
    categoryId: "tiles",
    condition: "new",
    quantity: 24,
    unit: "m²",
    unitPrice: 34,
    isFree: false,
    neighborhood: "Al Malqa",
    pickupDetails: "Pickup near Anas Bin Malik Road. Message before coming.",
    mapUrl: "https://maps.google.com/?q=Al+Malqa,+Riyadh",
    photos: ["/demo-tiles.jpg"],
    phone: null,
    phoneVisible: false,
    saleMode: "partial",
    minimumIncrement: 1.44,
    isAvailable: true,
  },
  {
    id: "sample-cement-bags",
    sellerId: "baqi-sample-seller-2",
    sellerName: "Baqi sample seller",
    sellerTrusted: false,
    title: "Sealed cement bags",
    description: "Unused surplus bags stored indoors. Sold by the bag.",
    categoryId: "building-materials",
    condition: "new",
    quantity: 18,
    unit: "bag",
    unitPrice: 17,
    isFree: false,
    neighborhood: "Al Yasmin",
    pickupDetails: "Collection from Al Yasmin. Bring a vehicle suitable for the load.",
    mapUrl: "https://maps.google.com/?q=Al+Yasmin,+Riyadh",
    photos: ["/demo-cement.jpg"],
    phone: null,
    phoneVisible: false,
    saleMode: "partial",
    minimumIncrement: 1,
    isAvailable: true,
  },
  {
    id: "sample-timber-free",
    sellerId: "baqi-sample-seller-3",
    sellerName: "Baqi sample seller",
    sellerTrusted: false,
    title: "Free pine timber offcuts",
    description: "Useful clean offcuts from a small project. Take the whole bundle.",
    categoryId: "timber",
    condition: "used",
    quantity: 12,
    unit: "piece",
    unitPrice: null,
    isFree: true,
    neighborhood: "Al Wurud",
    pickupDetails: "Free pickup from Al Wurud. Please arrange a time in chat.",
    mapUrl: "https://maps.google.com/?q=Al+Wurud,+Riyadh",
    photos: ["/demo-timber.jpg"],
    phone: null,
    phoneVisible: false,
    saleMode: "full_lot",
    minimumIncrement: 12,
    isAvailable: true,
  },
];

async function seedSampleListings(): Promise<void> {
  await db.insert(listingsTable).values([...sampleListings]).onConflictDoNothing();
}

function toListing(row: typeof listingsTable.$inferSelect) {
  const category = categoryById.get(row.categoryId);
  return GetListingResponse.parse({
    ...row,
    categoryNameEn: category?.nameEn ?? "Other",
    categoryNameAr: category?.nameAr ?? "متفرقات",
    sellerPhone: row.phoneVisible ? row.phone : null,
  });
}

router.use(createPhotoAssistantRouter(categories, toListing));

function toOrder(row: typeof ordersTable.$inferSelect) {
  return {
    id: row.id,
    listingId: row.listingId,
    listingTitle: row.listingTitle,
    quantity: row.quantity,
    unit: row.unit,
    total: row.total,
    depositDue: row.depositDue,
    balanceDue: row.balanceDue,
    status: row.status,
    paymentMethod: row.paymentMethod,
    receiptConfirmed: row.receiptConfirmed,
    createdAt: row.createdAt,
  };
}

function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

async function orderForBuyer(id: string, buyerId: string) {
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.id, id), eq(ordersTable.buyerId, buyerId)))
    .limit(1);
  return order;
}

async function conversationForMember(id: string, memberId: string) {
  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.id, id),
        or(eq(conversationsTable.buyerId, memberId), eq(conversationsTable.sellerId, memberId)),
      ),
    )
    .limit(1);
  return conversation;
}

router.get("/categories", (_req, res): void => {
  res.json(ListCategoriesResponse.parse(categories));
});

router.get("/listings", async (req, res): Promise<void> => {
  await seedSampleListings();
  const parsed = ListListingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const params = parsed.data;
  const filters = [
    eq(listingsTable.isAvailable, true),
    gte(listingsTable.quantity, 0.001),
  ];
  if (params.category) filters.push(eq(listingsTable.categoryId, params.category));
  if (params.condition) filters.push(eq(listingsTable.condition, params.condition));
  if (params.freeOnly) filters.push(eq(listingsTable.isFree, true));
  if (params.minQuantity !== undefined) filters.push(gte(listingsTable.quantity, params.minQuantity));
  if (params.unit) filters.push(eq(listingsTable.unit, params.unit));
  if (params.q?.trim()) {
    const term = `%${params.q.trim()}%`;
    filters.push(or(ilike(listingsTable.title, term), ilike(listingsTable.description, term))!);
  }

  const orderBy =
    params.sort === "price_low"
      ? asc(listingsTable.unitPrice)
      : params.sort === "price_high"
        ? desc(listingsTable.unitPrice)
        : desc(listingsTable.createdAt);
  const rows = await db.select().from(listingsTable).where(and(...filters)).orderBy(orderBy);
  res.json(ListListingsResponse.parse(rows.map(toListing)));
});

router.get("/listings/:id", async (req, res): Promise<void> => {
  await seedSampleListings();
  const params = GetListingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, params.data.id)).limit(1);
  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  res.json(GetListingResponse.parse(toListing(listing)));
});

router.post("/listings", requireUser, async (req, res): Promise<void> => {
  const sellerId = userIdFromRequest(req)!;
  const parsed = CreateListingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const input = parsed.data;
  if (!categoryById.has(input.categoryId)) {
    res.status(400).json({ error: "Choose a valid material category" });
    return;
  }
  if (input.saleMode === "partial" && input.minimumIncrement > input.quantity) {
    res.status(400).json({ error: "The minimum sale increment cannot exceed available quantity" });
    return;
  }
  if (!input.isFree && (input.unitPrice == null || input.unitPrice <= 0)) {
    res.status(400).json({ error: "Paid listings need a positive SAR price" });
    return;
  }
  if (input.isFree && input.unitPrice != null) {
    res.status(400).json({ error: "Free listings cannot have a price" });
    return;
  }

  // Validate ownership before publishing, rather than claiming somebody else's
  // object while changing its visibility after insertion.
  for (const photo of input.photos) {
    if (!photo.startsWith("/objects/")) {
      res.status(400).json({ error: "Listing photos must be uploaded using Baqi." }); return;
    }
    try {
      const file = await objectStorage.getObjectEntityFile(photo);
      if (!await ownsUpload(file, photo, sellerId)) {
        res.status(403).json({ error: "Photo ownership could not be verified. Upload your own copy.", code: "PHOTO_REUPLOAD_REQUIRED" }); return;
      }
    } catch { res.status(400).json({ error: "A photo is unavailable. Upload it again before publishing.", code: "PHOTO_REUPLOAD_REQUIRED" }); return; }
  }
  const id = randomUUID();
  const [listing] = await db.insert(listingsTable).values({
    id,
    sellerId,
    sellerName: await memberDisplayName(sellerId, "Baqi member"),
    sellerTrusted: false,
    title: input.title,
    description: input.description,
    categoryId: input.categoryId,
    condition: input.condition,
    quantity: input.quantity,
    unit: input.unit,
    unitPrice: input.isFree ? null : input.unitPrice!,
    isFree: input.isFree,
    neighborhood: input.neighborhood,
    pickupDetails: input.pickupDetails,
    mapUrl: input.mapUrl,
    photos: input.photos,
    phone: input.phone ?? null,
    phoneVisible: input.phoneVisible,
    saleMode: input.saleMode,
    minimumIncrement: input.saleMode === "full_lot" ? input.quantity : input.minimumIncrement,
    isAvailable: true,
  }).returning();

  for (const photo of input.photos) {
    if (!photo.startsWith("/objects/")) continue;
    try {
      await objectStorage.trySetObjectEntityAclPolicy(photo, {
        owner: sellerId,
        visibility: "public",
      });
    } catch (error) {
      req.log.warn({ err: error, listingId: id }, "Could not make listing photo public");
    }
  }
  res.status(201).json(CreateListingResponse.parse(toListing(listing)));
});

router.patch("/listings/:id", requireUser, async (req, res): Promise<void> => {
  const params = UpdateListingParams.safeParse(req.params);
  const parsed = UpdateListingBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid listing update" });
    return;
  }
  const sellerId = userIdFromRequest(req)!;
  const [currentListing] = await db.select().from(listingsTable).where(and(
    eq(listingsTable.id, params.data.id),
    eq(listingsTable.sellerId, sellerId),
  )).limit(1);
  if (!currentListing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  if (
    currentListing.saleMode === "partial" &&
    parsed.data.quantity !== undefined &&
    parsed.data.quantity > 0 &&
    parsed.data.quantity < currentListing.minimumIncrement
  ) {
    res.status(400).json({ error: "Available quantity cannot be lower than the minimum sale increment" });
    return;
  }
  const isAvailable = parsed.data.quantity !== undefined
    ? parsed.data.quantity > 0
    : parsed.data.isAvailable;
  const [listing] = await db
    .update(listingsTable)
    .set({
      ...parsed.data,
      isAvailable,
      ...(currentListing.saleMode === "full_lot" && parsed.data.quantity !== undefined
        ? { minimumIncrement: parsed.data.quantity }
        : {}),
    })
    .where(and(eq(listingsTable.id, params.data.id), eq(listingsTable.sellerId, sellerId)))
    .returning();
  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  res.json(UpdateListingResponse.parse(toListing(listing)));
});

router.get("/conversations", requireUser, async (req, res): Promise<void> => {
  const userId = userIdFromRequest(req)!;
  const rows = await db
    .select()
    .from(conversationsTable)
    .where(or(eq(conversationsTable.buyerId, userId), eq(conversationsTable.sellerId, userId)))
    .orderBy(desc(conversationsTable.updatedAt));

  const result = await Promise.all(rows.map(async (conversation) => {
    const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, conversation.listingId)).limit(1);
    const [message] = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, conversation.id)).orderBy(desc(messagesTable.createdAt)).limit(1);
    return {
      id: conversation.id,
      listingId: conversation.listingId,
      listingTitle: listing?.title ?? "Listing",
      participantName: await memberDisplayName(
        conversation.buyerId === userId ? conversation.sellerId : conversation.buyerId,
        conversation.buyerId === userId ? (listing?.sellerName ?? "Baqi member") : "Baqi buyer",
      ),
      lastMessage: message?.content ?? "",
      updatedAt: conversation.updatedAt,
    };
  }));
  res.json(ListConversationsResponse.parse(result));
});

router.post("/conversations", requireUser, async (req, res): Promise<void> => {
  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const buyerId = userIdFromRequest(req)!;
  const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, parsed.data.listingId)).limit(1);
  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  if (listing.sellerId === buyerId) {
    res.status(400).json({ error: "You cannot message yourself about your listing" });
    return;
  }

  let [conversation] = await db.select().from(conversationsTable).where(
    and(eq(conversationsTable.listingId, listing.id), eq(conversationsTable.buyerId, buyerId)),
  ).limit(1);
  if (!conversation) {
    [conversation] = await db.insert(conversationsTable).values({
      id: randomUUID(),
      listingId: listing.id,
      buyerId,
      sellerId: listing.sellerId,
    }).onConflictDoNothing().returning();
    if (!conversation) {
      [conversation] = await db.select().from(conversationsTable).where(
        and(eq(conversationsTable.listingId, listing.id), eq(conversationsTable.buyerId, buyerId)),
      ).limit(1);
    }
  }
  if (!conversation) {
    res.status(500).json({ error: "Could not start conversation" });
    return;
  }

  if (parsed.data.initialMessage?.trim()) {
    await db.insert(messagesTable).values({
      id: randomUUID(),
      conversationId: conversation.id,
      senderId: buyerId,
      senderName: await memberDisplayName(buyerId, "Baqi member"),
      content: parsed.data.initialMessage.trim(),
    });
    await db.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, conversation.id));
  }
  res.status(201).json(CreateConversationResponse.parse({
    id: conversation.id,
    listingId: listing.id,
    listingTitle: listing.title,
    participantName: await memberDisplayName(listing.sellerId, listing.sellerName),
    lastMessage: parsed.data.initialMessage?.trim() ?? "",
    updatedAt: new Date(),
  }));
});

router.get("/conversations/:id/messages", requireUser, async (req, res): Promise<void> => {
  const params = ListMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const conversation = await conversationForMember(params.data.id, userIdFromRequest(req)!);
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const rows = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, conversation.id)).orderBy(asc(messagesTable.createdAt));
  res.json(ListMessagesResponse.parse(rows));
});

router.post("/conversations/:id/messages", requireUser, async (req, res): Promise<void> => {
  const params = SendMessageParams.safeParse(req.params);
  const parsed = SendMessageBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid message" });
    return;
  }
  const userId = userIdFromRequest(req)!;
  const conversation = await conversationForMember(params.data.id, userId);
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const [message] = await db.insert(messagesTable).values({
    id: randomUUID(),
    conversationId: conversation.id,
    senderId: userId,
    senderName: await memberDisplayName(userId, userId === conversation.sellerId ? "Baqi seller" : "Baqi buyer"),
    content: parsed.data.content.trim(),
  }).returning();
  await db.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, conversation.id));
  res.status(201).json(SendMessageResponse.parse(message));
});

router.get("/orders", requireUser, async (req, res): Promise<void> => {
  const userId = userIdFromRequest(req)!;
  const rows = await db.select().from(ordersTable)
    .where(or(eq(ordersTable.buyerId, userId), eq(ordersTable.sellerId, userId)))
    .orderBy(desc(ordersTable.createdAt));
  res.json(ListOrdersResponse.parse(rows.map(toOrder)));
});

router.post("/orders", requireUser, async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const buyerId = userIdFromRequest(req)!;
  const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, parsed.data.listingId)).limit(1);
  if (!listing || !listing.isAvailable) {
    res.status(404).json({ error: "Listing is unavailable" });
    return;
  }
  if (parsed.data.quantity > listing.quantity) {
    res.status(409).json({ error: "This listing does not have enough stock" });
    return;
  }

  const actualQuantity = listing.saleMode === "full_lot"
    ? listing.quantity
    : Number((Math.ceil((parsed.data.quantity - 1e-9) / listing.minimumIncrement) * listing.minimumIncrement).toPrecision(12));
  if (actualQuantity > listing.quantity) {
    res.status(409).json({ error: "This listing does not have enough stock for its minimum increment" });
    return;
  }
  if (actualQuantity > parsed.data.quantity && !parsed.data.excessAccepted) {
    res.status(400).json({ error: `Confirm the purchasable quantity of ${actualQuantity} ${listing.unit}` });
    return;
  }
  const total = listing.isFree ? 0 : roundMoney(actualQuantity * (listing.unitPrice ?? 0));
  const depositDue = listing.isFree ? 0 : Math.min(total, Math.max(0.01, roundMoney(total * 0.1)));
  const balanceDue = roundMoney(total - depositDue);
  const id = randomUUID();

  const order = await db.transaction(async (tx) => {
    if (listing.isFree) {
      const [updated] = await tx.update(listingsTable)
        .set({
          quantity: sql`${listingsTable.quantity} - ${actualQuantity}`,
          isAvailable: sql`${listingsTable.quantity} - ${actualQuantity} > 0`,
        })
        .where(and(eq(listingsTable.id, listing.id), eq(listingsTable.isAvailable, true), gte(listingsTable.quantity, actualQuantity)))
        .returning({ id: listingsTable.id });
      if (!updated) return null;
    }
    const [created] = await tx.insert(ordersTable).values({
      id,
      listingId: listing.id,
      listingTitle: listing.title,
      buyerId,
      sellerId: listing.sellerId,
      quantity: actualQuantity,
      unit: listing.unit,
      total,
      depositDue,
      balanceDue,
      status: listing.isFree ? "free_pickup" : "pending_deposit",
      paymentMethod: null,
      depositPaid: listing.isFree,
      balancePaid: listing.isFree,
      receiptConfirmed: false,
    }).returning();
    return created;
  });
  if (!order) {
    res.status(409).json({ error: "Inventory changed; review the listing and try again" });
    return;
  }
  res.status(201).json(CreateOrderResponse.parse(toOrder(order)));
});

router.post("/orders/:id/deposit", requireUser, async (req, res): Promise<void> => {
  const params = PayOrderDepositParams.safeParse(req.params);
  const parsed = PayOrderDepositBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid deposit payment request" });
    return;
  }
  const buyerId = userIdFromRequest(req)!;
  const order = await orderForBuyer(params.data.id, buyerId);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (order.depositPaid) {
    res.json(PayOrderDepositResponse.parse(toOrder(order)));
    return;
  }
  if (order.status !== "pending_deposit") {
    res.status(409).json({ error: "This order is not awaiting a deposit" });
    return;
  }
  if (parsed.data.simulateFailure) {
    res.status(402).json({ error: "Demo deposit failed. Inventory was not allocated; retry this order." });
    return;
  }

  let result: typeof ordersTable.$inferSelect | null;
  try {
    result = await db.transaction(async (tx) => {
      const [claimed] = await tx.update(ordersTable)
        .set({ status: "deposit_processing" })
        .where(and(
          eq(ordersTable.id, order.id),
          eq(ordersTable.status, "pending_deposit"),
          eq(ordersTable.depositPaid, false),
        ))
        .returning({ id: ordersTable.id });
      if (!claimed) return null;

    const [allocated] = await tx.update(listingsTable)
      .set({
        quantity: sql`${listingsTable.quantity} - ${order.quantity}`,
        isAvailable: sql`${listingsTable.quantity} - ${order.quantity} > 0`,
      })
      .where(and(eq(listingsTable.id, order.listingId), eq(listingsTable.isAvailable, true), gte(listingsTable.quantity, order.quantity)))
      .returning({ id: listingsTable.id });
    if (!allocated) throw new InventoryAllocationError();
    const [updated] = await tx.update(ordersTable)
      .set({
        depositPaid: true,
        paymentMethod: parsed.data.method,
        status: "awaiting_pickup",
      })
      .where(eq(ordersTable.id, order.id))
      .returning();
    return updated ?? null;
    });
  } catch (error) {
    if (!(error instanceof InventoryAllocationError)) throw error;
    result = null;
  }
  if (!result) {
    res.status(409).json({ error: "Inventory was reserved by another buyer. No demo payment was recorded." });
    return;
  }
  res.json(PayOrderDepositResponse.parse(toOrder(result)));
});

router.post("/orders/:id/receipt", requireUser, async (req, res): Promise<void> => {
  const params = ConfirmOrderReceiptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const buyerId = userIdFromRequest(req)!;
  const order = await orderForBuyer(params.data.id, buyerId);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (order.receiptConfirmed) {
    res.json(ConfirmOrderReceiptResponse.parse(toOrder(order)));
    return;
  }
  if (!["awaiting_pickup", "free_pickup"].includes(order.status)) {
    res.status(409).json({ error: "This order is not ready for pickup confirmation" });
    return;
  }
  const [updated] = await db.update(ordersTable).set({
    receiptConfirmed: true,
    status: order.status === "free_pickup" ? "completed" : "balance_due",
  }).where(and(eq(ordersTable.id, order.id), eq(ordersTable.buyerId, buyerId), eq(ordersTable.receiptConfirmed, false))).returning();
  res.json(ConfirmOrderReceiptResponse.parse(toOrder(updated ?? order)));
});

router.post("/orders/:id/balance", requireUser, async (req, res): Promise<void> => {
  const params = PayOrderBalanceParams.safeParse(req.params);
  const parsed = PayOrderBalanceBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid balance payment request" });
    return;
  }
  const buyerId = userIdFromRequest(req)!;
  const order = await orderForBuyer(params.data.id, buyerId);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (order.balancePaid) {
    res.json(PayOrderBalanceResponse.parse(toOrder(order)));
    return;
  }
  if (!order.receiptConfirmed || order.status !== "balance_due") {
    res.status(409).json({ error: "Confirm pickup before paying the remaining balance" });
    return;
  }
  if (parsed.data.simulateFailure) {
    res.status(402).json({ error: "Demo balance payment failed. Your order and deposit are unchanged; retry when ready." });
    return;
  }
  const updated = await db.transaction(async (tx) => {
    const [completed] = await tx.update(ordersTable).set({
      balancePaid: true,
      status: "completed",
    }).where(and(eq(ordersTable.id, order.id), eq(ordersTable.buyerId, buyerId), eq(ordersTable.balancePaid, false))).returning();
    if (!completed) return null;
    await tx.insert(walletTransactionsTable).values({
      id: randomUUID(),
      sellerId: order.sellerId,
      orderId: order.id,
      type: "sale",
      amount: order.total,
      status: "available",
      description: `Completed sale: ${order.listingTitle}`,
    }).onConflictDoNothing();
    return completed;
  });
  if (!updated) {
    res.status(409).json({ error: "Order has already changed; refresh and try again" });
    return;
  }
  res.json(PayOrderBalanceResponse.parse(toOrder(updated)));
});

router.get("/wallet", requireUser, async (req, res): Promise<void> => {
  const sellerId = userIdFromRequest(req)!;
  const rows = await db.select().from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.sellerId, sellerId))
    .orderBy(desc(walletTransactionsTable.createdAt));
  const sales = rows.filter((row) => row.type === "sale" && row.status === "available").reduce((sum, row) => sum + row.amount, 0);
  const pendingWithdrawals = rows.filter((row) => row.type === "withdrawal" && row.status === "pending").reduce((sum, row) => sum + row.amount, 0);
  const completedWithdrawals = rows.filter((row) => row.type === "withdrawal" && row.status === "completed").reduce((sum, row) => sum + row.amount, 0);
  res.json(GetWalletResponse.parse({
    available: roundMoney(sales - pendingWithdrawals - completedWithdrawals),
    pending: roundMoney(pendingWithdrawals),
    completed: roundMoney(completedWithdrawals),
    transactions: rows.map((row) => ({
      id: row.id,
      type: row.type,
      amount: row.amount,
      status: row.status,
      description: row.description,
      createdAt: row.createdAt,
    })),
  }));
});

router.post("/wallet/withdrawals", requireUser, async (req, res): Promise<void> => {
  const parsed = RequestWithdrawalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const sellerId = userIdFromRequest(req)!;
  const transaction = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${sellerId}))`);
    const rows = await tx.select().from(walletTransactionsTable).where(eq(walletTransactionsTable.sellerId, sellerId));
    const sales = rows.filter((row) => row.type === "sale" && row.status === "available").reduce((sum, row) => sum + row.amount, 0);
    const committed = rows.filter((row) => row.type === "withdrawal" && ["pending", "completed"].includes(row.status)).reduce((sum, row) => sum + row.amount, 0);
    if (parsed.data.amount > roundMoney(sales - committed)) return null;
    const [created] = await tx.insert(walletTransactionsTable).values({
      id: randomUUID(),
      sellerId,
      orderId: null,
      type: "withdrawal",
      amount: parsed.data.amount,
      status: "pending",
      destination: parsed.data.destination,
      description: `Demo withdrawal to ${parsed.data.destination}`,
    }).returning();
    return created;
  });
  if (!transaction) {
    res.status(409).json({ error: "Withdrawal amount exceeds your available balance" });
    return;
  }
  res.status(201).json(RequestWithdrawalResponse.parse({
    id: transaction.id,
    type: transaction.type,
    amount: transaction.amount,
    status: transaction.status,
    description: transaction.description,
    createdAt: transaction.createdAt,
  }));
});

router.post("/help", async (req, res): Promise<void> => {
  const parsed = AskHelpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const question = parsed.data.question.toLowerCase();
  const arabic = /[\u0600-\u06ff]/.test(parsed.data.question) || parsed.data.language === "ar";
  const needsSupport = /refund|dispute|mismatch|cancel|عدم الاستلام|استرداد|نزاع|شكوى/.test(question);
  const answer = needsSupport
    ? arabic
      ? "تحتاج هذه المسألة إلى مراجعة فريق الدعم. لا يقرر المساعد النزاعات أو المبالغ المستردة."
      : "This needs support review. The assistant cannot decide disputes or refunds."
    : /balance|remaining|pickup|استلام|متبقي|الرصيد/.test(question)
      ? arabic
        ? "تدفع عربون 10٪ عند الحجز. بعد الاستلام تؤكد الطلب وتدفع المبلغ المتبقي من صفحة الطلب."
        : "Pay a 10% deposit when reserving. After pickup, confirm receipt and pay the remaining balance from your order."
      : /wallet|withdraw|سحب|محفظة/.test(question)
        ? arabic
          ? "تظهر عائدات البائع بعد تأكيد الاستلام وسداد الدفعتين. يمكنك طلب سحب تجريبي من صفحة المحفظة."
          : "Seller proceeds appear after pickup is confirmed and both payments are complete. Request a demo withdrawal from the wallet."
        : arabic
          ? "لإنشاء إعلان، أضف صورة ثم راجع الفئة والوصف والكمية والسعر وحي الاستلام. يمكنك إدخال التفاصيل يدويًا."
          : "To list an item, add a photo and review its category, description, quantity, price, and pickup neighborhood. You can enter details manually.";
  res.json(AskHelpResponse.parse({ answer, supportReferral: needsSupport }));
});

export default router;
