-- CreateTable
CREATE TABLE "schemas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "graphJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schemas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schema_versions" (
    "id" TEXT NOT NULL,
    "schemaId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "graphJson" JSONB NOT NULL,
    "restoredFrom" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schema_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schemas_name_key" ON "schemas"("name");

-- CreateIndex
CREATE UNIQUE INDEX "schema_versions_schemaId_version_key" ON "schema_versions"("schemaId", "version");

-- AddForeignKey
ALTER TABLE "schema_versions" ADD CONSTRAINT "schema_versions_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "schemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
