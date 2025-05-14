import axios from 'axios';
import * as core from '@actions/core';

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export type PollTestBatchResponse = {
  testRuns: Array<{
    runId: string;
    status: string;
    url: string;
  }>;
};

async function main() {
  const apiKey = core.getInput('apiKey') || process.env.PROPOLIS_API_KEY;
  const baseURL = 'https://api.propolis.tech'; 

  const triggerRes = await axios.post(
    `${baseURL}/api/testing/runAllTestsInBatch`,
    {},
    {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
    }
  );

  const batchRunId = triggerRes.data.batchRunId;
  if (!batchRunId) throw new Error('Missing batchRunId in trigger response');

  core.info(`Triggered batchRunId: ${batchRunId}`);

  while (true) {
    const pollRes = await axios.get<PollTestBatchResponse>(
      `${baseURL}/api/testing/pollTestBatch/${batchRunId}`,
      {
        headers: {
          'X-API-Key': apiKey,
        },
      }
    );

    const testRuns = pollRes.data.testRuns;
    const statuses = testRuns.map((r) => r.status);
    core.info(`Statuses: ${statuses.join(', ')}`);

    const allDone = statuses.every((s: string) =>
      ['COMPLETED', 'FAILED'].includes(s)
    );
    if (!allDone) {
      await sleep(10000);
      continue;
    }

    const failedTests = testRuns.filter((test) => test.status === 'FAILED');
    const passedTests = testRuns.filter((test) => test.status === 'COMPLETED');
    
    if (failedTests.length > 0) {
      let errorMessage = '❌ The following test suites failed:\n';
      failedTests.forEach((test) => {
        errorMessage += `- Test ${test.runId}: ${test.url}\n`;
      });
      core.setFailed(errorMessage);
      return;
    }

    core.info(`✅ All test suites passed. (${passedTests.length} tests completed successfully)`);
    return;
  }
}

main().catch((err) => {
  core.setFailed(`❌ Action failed: ${err.message}`);
});
