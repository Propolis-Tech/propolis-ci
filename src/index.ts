import axios from 'axios';
import * as core from '@actions/core';

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export type PollTestBatchResponse = {
  testRuns: Array<{
    friendlyName: string;
    runId: string;
    status: string;
    url: string;
  }>;
};

// Map test status to emojis for more readable logs
const statusIcon = (status: string): string => {
  switch (status) {
    case 'QUEUED':
      return '⏳';
    case 'RUNNING':
      return '🏃';
    case 'COMPLETED':
      return '✅';
    case 'FAILED':
      return '❌';
    default:
      return '';
  }
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

  // Expose the batchRunId for downstream steps if users need it
  core.setOutput('batchRunId', batchRunId);

  let pollCount = 0;

  while (true) {
    pollCount += 1;
    const pollRes = await axios.get<PollTestBatchResponse>(
      `${baseURL}/api/testing/pollTestBatch/${batchRunId}`,
      {
        headers: {
          'X-API-Key': apiKey,
        },
      }
    );

    const testRuns = pollRes.data.testRuns;
    // Group each poll cycle in the logs so users can easily collapse them
    await core.group(`🌀 Poll #${pollCount} – ${new Date().toLocaleTimeString()}`, async () => {
      testRuns.forEach((t) =>
        core.info(`${statusIcon(t.status)} ${t.friendlyName} → ${t.status} (${t.url})`)
      );
    });

    const statuses = testRuns.map((r) => r.status);

    const allDone = statuses.every((s: string) =>
      ['COMPLETED', 'FAILED'].includes(s)
    );
    if (!allDone) {
      await sleep(10000);
      continue;
    }

    const failedTests = testRuns.filter((test) => test.status === 'FAILED');
    const passedTests = testRuns.filter((test) => test.status === 'COMPLETED');
    
    // Build a job summary (visible at the top of the Actions page)
    const summaryTable = testRuns.map((t) => [
      { data: statusIcon(t.status), header: false },
      t.friendlyName,
      t.status,
      `<a href="${t.url}">Logs</a>`,
    ]);

    core.summary
      .addHeading('Propolis Test Batch Results', '2')
      .addTable([
        [
          { data: ' ', header: true },
          { data: 'Suite', header: true },
          { data: 'Status', header: true },
          { data: 'Link', header: true },
        ],
        ...summaryTable,
      ])
      .write();

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
