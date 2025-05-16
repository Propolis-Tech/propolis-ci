# Propolis CI GitHub Action

This GitHub Action triggers and monitors a batch of test suites in Propolis.

## 📦 Usage

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: Propolis-Tech/propolis-ci@v1
        with:
          apiKey: ${{ secrets.PROPOLIS_API_KEY }}
```

## 🔧 Inputs

| Name   | Description             | Required |
|--------|-------------------------|----------|
| apiKey | Your Propolis API key   | ✅ Yes |

## ✅ What It Does

- Triggers your enterprise's test suites via `/runAllTestsInBatch`
- Polls `/pollTestBatch/:batchRunId` until completion
- Fails the GitHub job if any test suite run fails

## 🚀 Setup Instructions

1. Add your Propolis API key to GitHub secrets as `PROPOLIS_API_KEY`.
2. Copy the usage snippet into `.github/workflows/ci.yml` in your repo.

## 📞 Support


Need help? Email me: matt@propolis.tech 
