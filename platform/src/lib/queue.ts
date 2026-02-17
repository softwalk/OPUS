import { Queue, Worker, Job } from "bullmq";
import redis from "./redis";

const connection = {
  host: new URL(process.env.REDIS_URL || "redis://localhost:6379").hostname,
  port: parseInt(new URL(process.env.REDIS_URL || "redis://localhost:6379").port || "6379"),
};

// Generation queue
export const generationQueue = new Queue("generation", { connection });

export interface GenerationJobData {
  generationId: string;
  appId: string;
  orgId: string;
  mvs: Record<string, unknown>;
  blueprintId: string;
  industryOverlay?: string;
}

export async function enqueueGeneration(data: GenerationJobData): Promise<string> {
  const job = await generationQueue.add("generate", data, {
    attempts: 1,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 3600 * 24 },
    removeOnFail: { age: 3600 * 24 * 7 },
  });
  return job.id!;
}

export function createGenerationWorker(
  processor: (job: Job<GenerationJobData>) => Promise<void>
): Worker<GenerationJobData> {
  return new Worker("generation", processor, {
    connection,
    concurrency: 2,
  });
}
