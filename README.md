# Propolis CI GitHub Action

This GitHub Action triggers and monitors a batch of test suites in Propolis.

## 📦 Usage

### Standard Mode (polls for results)
```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: Propolis-Tech/propolis-ci@main
        with:
          apiKey: ${{ secrets.PROPOLIS_API_KEY }}
          baseUrl: "https://your-app-under-test.com" # Optional
```

### Non-Blocking Mode (trigger only, no polling)
```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: Propolis-Tech/propolis-ci@main
        with:
          apiKey: ${{ secrets.PROPOLIS_API_KEY }}
          baseUrl: "https://your-app-under-test.com" # Optional
          nonBlocking: true # Just trigger tests, don't wait for results
```

## 🔧 Inputs

| Name          | Description                                                            | Required | Default |
|---------------|------------------------------------------------------------------------|----------|---------|
| apiKey        | Your Propolis API key                                                 | ✅ Yes   | -       |
| baseUrl       | URL of the application to test                                        | ❌ No    | -       |
| nonBlocking   | Skip polling for results and don't affect build status (trigger only) | ❌ No    | false   |

## ✅ What It Does

**Standard Mode (default):**
- Triggers your enterprise's test suites via `/runAllTestsInBatch`
- Polls `/pollTestBatch/:batchRunId` until completion
- Fails the GitHub job if any test suite run fails

**Non-Blocking Mode (when `nonBlocking: true`):**
- Triggers your enterprise's test suites via `/runAllTestsInBatch`
- Exits immediately after triggering (no polling)
- Does not affect build status based on test results
- Useful for triggering tests without blocking CI/CD pipelines
- Test failure notifications will still come through on Slack

## 🚀 Setup Instructions

1. Add your Propolis API key to GitHub secrets as `PROPOLIS_API_KEY`.
2. Copy the usage snippet into `.github/workflows/ci.yml` in your repo.

## 📞 Support


Need help? Email me: matt@propolis.tech 
