// Test script for running the GitHub Action locally
// This simulates the GitHub Actions environment

// Set up environment variables that @actions/core uses
process.env.INPUT_API_KEY =
  "11c8328ad449deeb.472cd7c45787bd1a50fd252c48d333a71d1fda80ded65f2fb537de18f93c2fee";
process.env.INPUT_JOB_ID = "b639fd2d-2644-4d57-88d3-ce9843a2211c";
process.env.INPUT_BASE_URL = "http://localhost:5173";
process.env.INPUT_REQUIRED_OUTPUTS = ""; // Empty for now

// Import and run the action
await import("./src/index.js");
