-- CreateTable
CREATE TABLE "LandingPage" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_LandingPageToProduct" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "LandingPage_url_key" ON "LandingPage"("url");

-- CreateIndex
CREATE UNIQUE INDEX "_LandingPageToProduct_AB_unique" ON "_LandingPageToProduct"("A", "B");

-- CreateIndex
CREATE INDEX "_LandingPageToProduct_B_index" ON "_LandingPageToProduct"("B");

-- AddForeignKey
ALTER TABLE "_LandingPageToProduct" ADD CONSTRAINT "_LandingPageToProduct_A_fkey" FOREIGN KEY ("A") REFERENCES "LandingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LandingPageToProduct" ADD CONSTRAINT "_LandingPageToProduct_B_fkey" FOREIGN KEY ("B") REFERENCES "TikTokProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill landing pages from product arrays and legacy catalog
WITH all_urls AS (
    SELECT trim(u) AS url
    FROM "TikTokProduct", unnest("landingPages") AS u
    WHERE trim(u) <> ''
    UNION
    SELECT trim(url) AS url
    FROM "LandingUrlCatalog"
    WHERE trim(url) <> ''
),
unique_urls AS (
    SELECT DISTINCT ON (lower(url)) url
    FROM all_urls
    ORDER BY lower(url), url
)
INSERT INTO "LandingPage" ("id", "url", "createdAt", "updatedAt")
SELECT
    'c' || substr(md5(random()::text || url || clock_timestamp()::text), 1, 24),
    url,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM unique_urls;

-- Backfill product associations
INSERT INTO "_LandingPageToProduct" ("A", "B")
SELECT DISTINCT lp."id", p."id"
FROM "TikTokProduct" p
CROSS JOIN LATERAL unnest(p."landingPages") AS u(url)
JOIN "LandingPage" lp ON lower(lp."url") = lower(trim(u.url))
WHERE trim(u.url) <> '';

-- Drop legacy array column
ALTER TABLE "TikTokProduct" DROP COLUMN "landingPages";
