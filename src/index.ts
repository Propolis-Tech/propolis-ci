import axios from 'axios';
import * as core from '@actions/core';

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function main() {
  const apiKey = core.getInput('apiKey');
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
    const pollRes = await axios.get(
      `${baseURL}/api/testing/pollTestBatch/${batchRunId}`,
      {
        headers: {
          'X-API-Key': apiKey,
        },
      }
    );

    const statuses = pollRes.data.testSuiteRuns.map((r: any) => r.status);
    core.info(`Statuses: ${statuses.join(', ')}`);

    const allDone = statuses.every((s) =>
      ['COMPLETED', 'FAILED'].includes(s)
    );
    if (!allDone) {
      await sleep(10000);
      continue;
    }

    const anyFailed = statuses.includes('FAILED');
    if (anyFailed) {
      core.setFailed('❌ One or more test suites failed.');
      return;
    }

    core.info('✅ All test suites passed.');
    return;
  }
}

main().catch((err) => {
  core.setFailed(`❌ Action failed: ${err.message}`);
});
