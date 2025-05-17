import { defineConfig, devices } from '@playwright/test';
import { OrtoniReportConfig } from 'ortoni-report';
import path from 'path';
import EnvironmentDetector from './src/config/environmentDetector';
import AuthStorageManager from './src/utils/auth/storage/authStorageManager';
import BrowserInitFlag from './src/utils/environment/browserInitFlag';

// Detect if running in Continuous Integration environment
const isCI = EnvironmentDetector.isRunningInCI();

// Path to the authentication state storage file
const authStorageFilePath = AuthStorageManager.resolveAuthStateFilePath();

// Performance optimization: Skip browser initialization for crypto and database operations
const shouldSkipBrowserInit = BrowserInitFlag.shouldSkipBrowserInit();

// Operation timeout configurations (in milliseconds)
// CI environments use longer timeouts to accommodate potential resource constraints
const TIMEOUTS = {
  test: isCI ? 160_000 : 80_000, // Test execution timeout
  expect: isCI ? 160_000 : 80_000, // Assertion wait timeout
  action: isCI ? 140_000 : 70_000, // User action timeout
  navigation: isCI ? 50_000 : 25_000, // Page navigation timeout
};

const reportConfig: OrtoniReportConfig = {
  open: isCI ? 'never' : 'always',
  folderPath: 'ortoni-report',
  filename: 'index.html',
  logo: path.resolve(process.cwd(), "./assets/orange-hrm-logo.jpg"),
  title: 'Orange HRM Test Report',
  showProject: false,
  projectName: 'playwright-advanced-automation-framework',
  testType: process.env.TEST_TYPE || 'Regression | Sanity',
  authorName: 'Tshifhiwa Sinugo',
  base64Image: false,
  stdIO: false,
  preferredTheme: 'dark',
  meta: {
    project: 'playwright-advanced-automation-framework',
    description:
      'A framework for validating Orange HRM across UI, and workflows to ensure seamless integration and quality',
    platform: process.env.TEST_PLATFORM || 'Windows',
    environment: process.env.ENV || 'QA',
  },
};

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
// Debug log to verify worker count calculation

export default defineConfig({
  timeout: TIMEOUTS.test,
  expect: {
    timeout: TIMEOUTS.expect,
  },
  testDir: './tests',
  globalSetup: './src/config/environment/global/globalEnvironmentSetup.ts',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!isCI,
  /* Retry on CI only */
  retries: isCI ? 2 : 0,

  workers: isCI ? undefined : 4,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: isCI
    ? [
        ['html', { open: 'never' }],
        ['junit', { outputFile: 'results.xml' }],
        ['ortoni-report', reportConfig],
        ['dot'],
        ['playwright-trx-reporter', { outputFile: 'results.trx' }],
      ]
    : [
        ['html', { open: 'never' }],
        ['junit', { outputFile: 'results.xml' }],
        ['ortoni-report', reportConfig],
        ['allure-playwright', { outputFolder: 'allure-results' }],
        ['dot'],
        ['playwright-trx-reporter', { outputFile: 'results.trx' }],
      ],
  grep:
    typeof process.env.PLAYWRIGHT_GREP === 'string'
      ? new RegExp(process.env.PLAYWRIGHT_GREP)
      : process.env.PLAYWRIGHT_GREP || /.*/,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://127.0.0.1:3000',

    /*
     *Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer
     * Taking screenshot and videos during test execution
     * Maximum time each action such as click() can take. Defaults to 0 (no limit).
     * Maximum time the page can wait for actions such as waitForSelector(). Defaults to 0 (no limit).
     */
    actionTimeout: TIMEOUTS.action,
    navigationTimeout: TIMEOUTS.navigation,
    trace: 'on-first-retry',
    // Take screenshots on failure in CI and locally
    screenshot: isCI ? 'only-on-failure' : 'on',
    // Record videos for all tests in CI, only failed tests locally
    video: isCI ? 'on' : 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    /*
     * Project configuration with conditional browser setup:
     *
     * 1. When shouldSkipBrowserInit is FALSE (normal mode):
     *    - We include the "setup" project that handles browser initialization
     *    - The "setup" project runs tests matching the *.setup.ts pattern
     *    - The "chromium" project depends on "setup" to ensure proper sequencing
     *    - This ensures authentication is properly established before tests run
     *
     * 2. When shouldSkipBrowserInit is TRUE (performance optimization):
     *    - We completely skip the "setup" project (empty array is spread)
     *    - The "chromium" project has no dependencies (empty dependencies array)
     *    - This optimization is useful for operations that don't need browser context
     *      like crypto or database-only operations
     *
     * In both cases, the "chromium" project uses the authentication state from
     * the file path specified in authStorageFilePath.
     */
    ...(!shouldSkipBrowserInit
      ? [
          {
            name: 'setup',
            use: { ...devices['Desktop Chrome'] },
            testMatch: /.*\.setup\.ts/,
          },
        ]
      : []),
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authStorageFilePath, // Use the authentication state file path
      },
      dependencies: shouldSkipBrowserInit ? [] : ['setup'], // If browser init should be skipped, don't depend on "setup"
    },
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'], storageState: authStorageFilePath },
    //   dependencies: shouldSkipBrowserInit ? [] : ['setup'],
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'], storageState: authStorageFilePath },
    //   dependencies: shouldSkipBrowserInit ? [] : ['setup'],
    // },
    // {
    //   name: 'chromium',
    //   use: { ...devices['Desktop Chrome'] },
    // },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !isCI,
  // },
});
