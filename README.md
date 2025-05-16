# Playwright Advanced Automation Framework

This repository hosts the **Orange HRM Test Automation Framework**, developed using **Playwright** and **TypeScript**. The framework is architected with a strong emphasis on **scalability**, **security**, and **maintainability**, making it ideal for comprehensive UI and API automation.

---

## 📚 Table of Contents

- [Installation](#-installation)
- [Environment Setup](#️-environment-setup)
- [Encryption](#-encryption)
- [Authentication & Test Context](#-authentication--test-context)
- [Running Tests](#-running-tests)
- [Developer Tools](#-developer-tools)
- [Running Tests by Tag](#-running-tests-by-tag)
- [Logger](#logger)
- [Centralized Error Handling](#centralized-error-handling)
- [Sanitization](#sanitization)
- [Async File Manager](#asyncfilemanager)
- [Reporting](#reporting)
- [Notes](#-notes)

---

## 🔧 Installation

Ensure **Node.js** is installed on your machine. Then install the project dependencies:

```bash
npm install
```

---

## ⚙️ Environment Setup

Before running tests, set up your environment variables and encryption settings.

### 1. Configure Environment Variables

Navigate to the `envs/` directory and copy the example file:

```bash
cp envs/.env.uat.example envs/.env.uat
```

Edit `.env.uat` with your credentials:

```env
PORTAL_USERNAME=your.username
PORTAL_PASSWORD=your.password
```

> ℹ️ The root `.env` file is managed automatically. Do not edit it manually.

---

Here's a polished and professional version of your README section with improved clarity, grammar, and formatting—particularly for the **Encryption** portion and the new section about running both key generation and encryption:

---

## 🔐 Encryption

Sensitive credentials are encrypted using **AES-GCM** along with **Argon2 hashing** to ensure secure and tamper-resistant storage and transmission.

### 🛠️ Command-Line Utilities

#### 🔑 Generate a Secret Key

Use the following command to generate a unique secret key for your environment:

```bash
npx cross-env PLAYWRIGHT_GREP=@generate-key npm run test:encryption:uat
```

#### 🔒 Encrypt Credentials

After generating the key, run the encryption process to secure your credentials:

```bash
npx cross-env PLAYWRIGHT_GREP=@encrypt npm run test:encryption:uat
```

#### 🔁 Run Both: Generate Key and Encrypt

To streamline the process, you can run both the **key generation** and **encryption** steps in one command:

```bash
npx cross-env PLAYWRIGHT_GREP=@encryption npm run test:encryption:uat
```

> 💡 Replace `uat` with `dev`, `prod`, or any custom environment. Ensure that the corresponding `.env.<env>` file exists in the `envs/` directory.

**Example:**

```bash
npx cross-env PLAYWRIGHT_GREP=@encryption npm run test:encryption:dev
```

> ⚠️ **Important**: Always generate a new secret key **before** encrypting credentials—especially when rotating secrets or modifying environment-specific data.

---

## 🔐 Authentication & Authentication Context

Authentication and session management are handled using **Playwright fixtures** and the reusable `AuthenticationContext` utility.

### Authentication Configuration

Customize login behavior per test:

```ts
test.use({
  requireAuth: false,
  requireAuthState: false,
});
```

Dynamic login setup example:

```ts
await authenticationContext.configureLoginState({
  requireAuth: true,
  requireAuthState: false,
});
```

**Parameters:**

- `requireAuth`: Whether to perform login.
- `requireAuthState`: Whether to reuse login state.

### Test Context Utility

The `TestContext` utility supports:

- Portal navigation
- Login with encrypted credentials
- Session state management

---

## 🧪 Running Tests

Use these commands to run tests in different environments:

| Command                   | Description                            |
| ------------------------- | -------------------------------------- |
| `npm run test:all:uat`    | Run all tests (UI, API, DB) in UAT     |
| `npm run test:api:uat`    | Run only API tests in UAT              |
| `npm run test:ui:uat`     | Run only UI tests in UAT               |
| `npm run test:auth:uat`   | Run auth flow and generate login state |
| `npm run test:failed:uat` | Run only Failed Tests                  |

> 💡 Replace `uat` with `dev`, `prod`, or your target environment.

---

## 🛠️ Additional Commands

Tools to boost productivity and maintain code quality:

| Command          | Description                           |
| ---------------- | ------------------------------------- |
| `npm run ui`     | Launch Playwright Test Runner UI      |
| `npm run record` | Open Playwright Code Generator        |
| `npm run report` | View HTML report of the last test run |
| `npm run format` | Format code using Prettier            |

---

## 🏷️ Running Tests by Tag

Filter tests using the `PLAYWRIGHT_GREP` environment variable.

### Local Examples

| Command                                                         | Description                         |
| --------------------------------------------------------------- | ----------------------------------- |
| `npx cross-env PLAYWRIGHT_GREP=sanity npm run test:all:uat`     | Run all **sanity** tests in UAT     |
| `npx cross-env PLAYWRIGHT_GREP=regression npm run test:all:uat` | Run all **regression** tests in UAT |

### CI/CD Example (Azure DevOps)

```yaml
- script: |
    set CI=true
    npm run test:all:uat
  env:
    ${{ if eq(parameters.testType, 'sanity') }}:
      PLAYWRIGHT_GREP: '@sanity'
    ${{ if eq(parameters.testType, 'regression') }}:
      PLAYWRIGHT_GREP: '@regression'
  displayName: 'Run ${{ parameters.testType }} Tests'
  timeoutInMinutes: 120
```

---

## 📋 Logger

The framework uses the **Winston** logger with environment-based log levels:

- **debug** → `dev`
- **info** → `uat`
- **error** → `prod`

---

## ❗ Centralized Error Handling

A robust centralized system for error logging, categorization, and reporting, including:

### Features

1. **Unified Categorization** via `ErrorCategory` enum:

   - API, DB, UI, auth, I/O, service, network, etc.

2. **Security & Sanitization**:

   - Removes stack traces, sensitive paths, and headers

3. **API Error Response Builder**:

   - Converts internal errors into REST-compliant responses

4. **ErrorProcessor Utility**:

   - Cleans, deduplicates, categorizes, and logs errors

### Usage Example

```ts
ErrorHandler.captureError(error, 'methodName', 'context');
throw error;
```

In API context:

```ts
ApiErrorResponseBuilder.captureApiError(error, 'methodName', 'context');
throw error;
```

---

## 🧼 Sanitization

### `SanitizationConfig`

A utility to mask sensitive data in logs and responses.

#### Default Masked Keys:

```ts
['password', 'apiKey', 'secret', 'authorization', 'token', 'accessToken', 'refreshToken', 'cookie'];
```

#### Features:

- Object & header sanitization
- Path-based masking
- Key-value pair masking
- URL-aware truncation
- Integration with Winston

#### Example:

```ts
const sanitized = SanitizationConfig.sanitizeData(userData);
```

---

## 📁 AsyncFileManager

A modern, promise-based utility for secure file operations.

### Key Features

- Safe async read/write
- Directory handling
- Path validation
- Integrated logging

### Example

```ts
const config = await AsyncFileManager.readFile('config.json');
await AsyncFileManager.writeFile('out.txt', 'Hello');
```

---

## 📊 Reporting

- **Playwright HTML report**:

  ```bash
  npm run report
  ```

- **Allure Report**:

  ```bash
  npm run allure:generate
  npm run allure:open
  npm run allure           # Generate and open
  ```

---

## 📝 Notes

- ❌ **Never commit `.env` files** to version control.
- 🔐 Always regenerate encryption keys when credentials change.
- 📦 Run `npm install` after switching branches or pulling updates.
- ⚡ Reusing authentication state speeds up tests and reduces flakiness.
- ✅ The framework is CI-ready and designed for long-term growth.

---
