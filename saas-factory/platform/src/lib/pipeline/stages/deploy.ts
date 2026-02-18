import type { StageHandler } from "../types";
import { execSync } from "child_process";
import { existsSync, readdirSync } from "fs";
import { join } from "path";

const BASE_PORT = parseInt(process.env.DEPLOY_BASE_PORT || "4000");

function findAppDirectory(appId: string): string {
  const basePath = join(process.env.GENERATED_APPS_PATH || "./generated", appId);
  if (!existsSync(basePath)) throw new Error(`Generated app directory not found: ${basePath}`);

  // Get the latest version directory
  const versions = readdirSync(basePath).sort().reverse();
  if (versions.length === 0) throw new Error("No generated versions found");

  return join(basePath, versions[0]);
}

function getAvailablePort(): number {
  // Simple port assignment: base port + random offset
  return BASE_PORT + Math.floor(Math.random() * 1000);
}

export const deployStage: StageHandler = {
  name: "deploy",
  async execute(ctx) {
    if (!ctx.files || ctx.files.length === 0) {
      throw new Error("No generated files to deploy");
    }

    const appDir = findAppDirectory(ctx.appId);
    const port = getAvailablePort();
    const containerName = `saas-app-${ctx.appId.substring(0, 8)}`;

    // Check if Dockerfile exists in generated code
    const hasDockerfile = ctx.files.some((f) => f.path === "Dockerfile" || f.path === "./Dockerfile");

    if (!hasDockerfile) {
      // App generated without Dockerfile - mark as generated but not deployed
      console.log("No Dockerfile in generated code - skipping Docker deploy");
      ctx.deployUrl = undefined;
      return ctx;
    }

    try {
      // Stop any existing container with same name
      try {
        execSync(`docker stop ${containerName} 2>/dev/null && docker rm ${containerName} 2>/dev/null`, {
          cwd: appDir,
          stdio: "pipe",
        });
      } catch {
        // Container doesn't exist, that's fine
      }

      // Build Docker image
      console.log(`Building Docker image for app ${ctx.appId}...`);
      execSync(`docker build -t ${containerName} .`, {
        cwd: appDir,
        stdio: "pipe",
        timeout: 300000, // 5 min
      });

      // Run container
      console.log(`Starting container on port ${port}...`);
      const result = execSync(
        `docker run -d --name ${containerName} -p ${port}:3000 ${containerName}`,
        {
          cwd: appDir,
          stdio: "pipe",
          timeout: 30000,
        }
      );

      const containerId = result.toString().trim();

      // Wait for health check
      let healthy = false;
      for (let i = 0; i < 30; i++) {
        try {
          execSync(`curl -sf http://localhost:${port}/ > /dev/null 2>&1`, {
            timeout: 5000,
          });
          healthy = true;
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      if (!healthy) {
        console.warn("Health check failed - container may still be starting");
      }

      ctx.deployUrl = `http://localhost:${port}`;
      ctx.deployPort = port;
      ctx.containerId = containerId;

      console.log(`App deployed at ${ctx.deployUrl}`);
    } catch (err) {
      console.error("Deploy failed:", err);
      // Don't fail the pipeline for deploy errors - app is still generated
      ctx.deployUrl = undefined;
    }

    return ctx;
  },
};
