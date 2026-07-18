-- AlterTable
ALTER TABLE "nodes" ADD COLUMN     "parent_id" INTEGER;

-- AddForeignKey
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
