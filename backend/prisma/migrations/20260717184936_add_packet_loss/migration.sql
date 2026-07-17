-- AlterTable
ALTER TABLE "event_logs" ADD COLUMN     "max_latency_ms" DOUBLE PRECISION,
ADD COLUMN     "min_latency_ms" DOUBLE PRECISION,
ADD COLUMN     "packet_loss" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "nodes" ADD COLUMN     "max_latency_ms" DOUBLE PRECISION,
ADD COLUMN     "min_latency_ms" DOUBLE PRECISION,
ADD COLUMN     "packet_loss" DOUBLE PRECISION;
