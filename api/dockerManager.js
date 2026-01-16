const { exec, spawn } = require("child_process");
const http = require("http");

const CONTAINER_NAME = "js-code-runner";
const IMAGE_NAME = "js-code-runner:latest";
const CONTAINER_PORT = 3001;
const MEMORY_LIMIT = "256m";

class DockerManager {
  constructor() {
    this.containerRunning = false;
    this.containerHost = null;
  }

  // Execute shell command as promise
  execCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  // Build the runner Docker image
  async buildImage() {
    console.log("Building Docker image...");
    try {
      await this.execCommand(`docker build -t ${IMAGE_NAME} ../runner`);
      console.log("Docker image built successfully");
    } catch (err) {
      throw new Error(`Failed to build image: ${err.message}`);
    }
  }

  // Check if container exists
  async containerExists() {
    try {
      const result = await this.execCommand(
        `docker ps -a --filter "name=${CONTAINER_NAME}" --format "{{.Names}}"`
      );
      return result === CONTAINER_NAME;
    } catch {
      return false;
    }
  }

  // Check if container is running
  async isContainerRunning() {
    try {
      const result = await this.execCommand(
        `docker ps --filter "name=${CONTAINER_NAME}" --filter "status=running" --format "{{.Names}}"`
      );
      return result === CONTAINER_NAME;
    } catch {
      return false;
    }
  }

  // Get container IP address
  async getContainerIP() {
    try {
      const ip = await this.execCommand(
        `docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${CONTAINER_NAME}`
      );
      return ip;
    } catch {
      return null;
    }
  }

  // Start the runner container
  async startContainer() {
    console.log("Starting runner container...");

    // Check if container already exists
    if (await this.containerExists()) {
      if (await this.isContainerRunning()) {
        console.log("Container already running");
        this.containerHost = await this.getContainerIP();
        this.containerRunning = true;
        return;
      }
      // Remove stopped container
      await this.execCommand(`docker rm ${CONTAINER_NAME}`);
    }

    // Start new container
    try {
      await this.execCommand(
        `docker run -d --name ${CONTAINER_NAME} --memory=${MEMORY_LIMIT} -p ${CONTAINER_PORT}:${CONTAINER_PORT} ${IMAGE_NAME}`
      );

      // Wait a bit for container to start
      await new Promise((resolve) => setTimeout(resolve, 1000));

      this.containerHost = await this.getContainerIP();
      this.containerRunning = true;
      console.log(`Container started with IP: ${this.containerHost}`);
    } catch (err) {
      throw new Error(`Failed to start container: ${err.message}`);
    }
  }

  // Stop the container
  async stopContainer() {
    console.log("Stopping runner container...");
    try {
      await this.execCommand(`docker stop ${CONTAINER_NAME}`);
      await this.execCommand(`docker rm ${CONTAINER_NAME}`);
      this.containerRunning = false;
      console.log("Container stopped");
    } catch (err) {
      console.error(`Failed to stop container: ${err.message}`);
    }
  }

  // Health check
  async healthCheck() {
    return new Promise((resolve) => {
      const req = http.request(
        {
          hostname: "localhost",
          port: CONTAINER_PORT,
          path: "/health",
          method: "GET",
          timeout: 2000,
        },
        (res) => {
          resolve(res.statusCode === 200);
        }
      );

      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  // Wait for container to be healthy
  async waitForHealthy(maxAttempts = 10) {
    console.log("Waiting for container to be healthy...");
    for (let i = 0; i < maxAttempts; i++) {
      if (await this.healthCheck()) {
        console.log("Container is healthy");
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error("Container failed to become healthy");
  }

  // Execute code in the runner
  async executeCode(code) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({ code });

      const req = http.request(
        {
          hostname: "localhost",
          port: CONTAINER_PORT,
          path: "/execute",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData),
          },
          timeout: 5000, // 5s total timeout (includes 1s execution limit)
        },
        (res) => {
          let data = "";

          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error("Invalid response from runner"));
            }
          });
        }
      );

      req.on("error", (err) => {
        reject(new Error(`Runner request failed: ${err.message}`));
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Runner request timed out"));
      });

      req.write(postData);
      req.end();
    });
  }

  // Initialize - build image and start container
  async initialize() {
    await this.buildImage();
    await this.startContainer();
    await this.waitForHealthy();
  }
}

module.exports = DockerManager;
