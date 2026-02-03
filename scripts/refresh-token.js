/**
 * Playwright script to capture CivicClerk Bearer token
 * 
 * This script:
 * 1. Opens the CivicClerk portal
 * 2. Navigates to trigger API calls
 * 3. Intercepts network requests to capture the Bearer token
 * 4. Updates the Vercel environment variable
 */

const { chromium } = require("playwright");

const CIVICCLERK_PORTAL = "https://santafenm.portal.civicclerk.com/";
const CIVICCLERK_API_PATTERN = /santafenm\.api\.civicclerk\.com/;

async function captureToken() {
  console.log("Starting token capture...");
  
  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  let capturedToken = null;

  // Intercept network requests to capture the Bearer token
  page.on("request", (request) => {
    const url = request.url();
    if (CIVICCLERK_API_PATTERN.test(url) && !capturedToken) {
      const authHeader = request.headers()["authorization"];
      if (authHeader && authHeader.startsWith("Bearer ")) {
        capturedToken = authHeader.replace("Bearer ", "");
        console.log("Token captured successfully");
      }
    }
  });

  try {
    // Navigate to portal
    console.log("Navigating to CivicClerk portal...");
    await page.goto(CIVICCLERK_PORTAL, { waitUntil: "networkidle" });

    // Wait a bit for any initial API calls
    await page.waitForTimeout(2000);

    // If no token yet, try clicking on Meetings link to trigger API call
    if (!capturedToken) {
      console.log("Clicking Meetings link to trigger API...");
      const meetingsLink = page.locator('a:has-text("Meetings")').first();
      if (await meetingsLink.isVisible()) {
        await meetingsLink.click();
        await page.waitForTimeout(3000);
      }
    }

    // Try clicking on any meeting item if still no token
    if (!capturedToken) {
      console.log("Clicking a meeting item...");
      const meetingItem = page.locator('[class*="event"], [class*="meeting"], .list-item').first();
      if (await meetingItem.isVisible()) {
        await meetingItem.click();
        await page.waitForTimeout(3000);
      }
    }

  } catch (error) {
    console.error("Error during navigation:", error.message);
  } finally {
    await browser.close();
  }

  return capturedToken;
}

async function updateVercelEnv(token) {
  const vercelToken = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const orgId = process.env.VERCEL_ORG_ID;

  if (!vercelToken || !projectId) {
    console.error("Missing VERCEL_TOKEN or VERCEL_PROJECT_ID");
    return false;
  }

  console.log("Updating Vercel environment variable...");

  const teamParam = orgId ? `&teamId=${orgId}` : "";

  // First, try to get existing env var to get its ID
  const listResponse = await fetch(
    `https://api.vercel.com/v9/projects/${projectId}/env?${teamParam}`,
    {
      headers: {
        Authorization: `Bearer ${vercelToken}`,
      },
    }
  );

  if (!listResponse.ok) {
    console.error("Failed to list env vars:", await listResponse.text());
    return false;
  }

  const envVars = await listResponse.json();
  const existing = envVars.envs?.find((e) => e.key === "CIVICCLERK_TOKEN");

  if (existing) {
    // Update existing
    const updateResponse = await fetch(
      `https://api.vercel.com/v9/projects/${projectId}/env/${existing.id}?${teamParam}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          value: token,
        }),
      }
    );

    if (!updateResponse.ok) {
      console.error("Failed to update env var:", await updateResponse.text());
      return false;
    }

    console.log("Environment variable updated successfully");
  } else {
    // Create new
    const createResponse = await fetch(
      `https://api.vercel.com/v10/projects/${projectId}/env?${teamParam}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "CIVICCLERK_TOKEN",
          value: token,
          type: "encrypted",
          target: ["production", "preview", "development"],
        }),
      }
    );

    if (!createResponse.ok) {
      console.error("Failed to create env var:", await createResponse.text());
      return false;
    }

    console.log("Environment variable created successfully");
  }

  return true;
}

async function main() {
  try {
    const token = await captureToken();

    if (!token) {
      console.error("Failed to capture token");
      process.exit(1);
    }

    console.log(`Token length: ${token.length} characters`);

    // Only update Vercel if we have the credentials
    if (process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID) {
      const updated = await updateVercelEnv(token);
      if (updated) {
        // Set output for GitHub Actions
        const fs = require("fs");
        const outputFile = process.env.GITHUB_OUTPUT;
        if (outputFile) {
          fs.appendFileSync(outputFile, `token_updated=true\n`);
        }
      }
    } else {
      // Just print the token for manual use
      console.log("\n--- TOKEN START ---");
      console.log(token);
      console.log("--- TOKEN END ---\n");
    }

    process.exit(0);
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main();
