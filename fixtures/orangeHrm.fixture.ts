import { test as baseTest, TestInfo } from '@playwright/test';
import { EnvironmentResolver } from '../src/config/environment/resolver/environmentResolver';
import AuthStorageManager from '../src/utils/auth/storage/authStorageManager';
import { FetchCIEnvironmentVariables } from '../src/config/environment/resolver/fetchCIEnvironmentVariables';
import { FetchLocalEnvironmentVariables } from '../src/config/environment/resolver/fetchLocalEnvironmentVariables';
import { BrowserSessionManager } from '../src/utils/auth/state/browserSessionManager';
import { AuthenticationContext } from './authenticationContext';


import { LoginPage } from '../src/ui/pages/loginPage';
import { SideMenuPage } from '../src/ui/pages/sideMenuPage';
import { TopMenuPage } from '../src/ui/pages/topMenuPage';

type OrangeHrmFixtures = {
  // Config
  requireAuth: boolean;
  requireAuthState: boolean;
  authenticationContext: AuthenticationContext;
  browserSessionManager: BrowserSessionManager;

  // Common
  environmentResolver: EnvironmentResolver;
  fetchCIEnvironmentVariables: FetchCIEnvironmentVariables;
  fetchLocalEnvironmentVariables: FetchLocalEnvironmentVariables;
  testInfo: TestInfo;

  // UI
  loginPage: LoginPage;
  sideMenuPage: SideMenuPage;
  topMenuPage: TopMenuPage;
};

const orangeHrmTests = baseTest.extend<OrangeHrmFixtures>({
  // Config
  requireAuth: [true, { option: true }],
  requireAuthState: [true, { option: true }],

  authenticationContext: async ({ environmentResolver, loginPage, sideMenuPage }, use) => {
    await use(new AuthenticationContext(environmentResolver, loginPage, sideMenuPage));
  },
  browserSessionManager: async ({ page }, use) => {
    await use(new BrowserSessionManager(page));
  },

  // Common
  fetchCIEnvironmentVariables: async ({}, use) => {
    await use(new FetchCIEnvironmentVariables());
  },
  fetchLocalEnvironmentVariables: async ({}, use) => {
    await use(new FetchLocalEnvironmentVariables());
  },
  environmentResolver: async (
    { fetchCIEnvironmentVariables, fetchLocalEnvironmentVariables },
    use,
  ) => {
    await use(new EnvironmentResolver(fetchCIEnvironmentVariables, fetchLocalEnvironmentVariables));
  },
  testInfo: async ({}, use) => {
    await use(baseTest.info());
  },

  // UI

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  sideMenuPage: async ({ page }, use) => {
    await use(new SideMenuPage(page));
  },
  topMenuPage: async ({ page }, use) => {
    await use(new TopMenuPage(page));
  },
context: async ({ browser, requireAuth }, use) => {
  let storageState: string | undefined;

  if (requireAuth) {
    storageState = await AuthStorageManager.getStorageState();
  }

  const context = await browser.newContext({ storageState });
  await use(context);
}

});

export const test = orangeHrmTests;
export const expect = baseTest.expect;
