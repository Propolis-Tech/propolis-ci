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
    case 'NEEDS_MANUAL_REVIEW':
      return '🏃';
    case 'COMPLETED':
      return '✅';
    case 'FAILED':
      return '❌';
    case 'AGENT_ERROR':
      return '🤖⚠️';
    default:
      return '';
  }
};

async function main() {
  const apiKey = core.getInput('apiKey') || process.env.PROPOLIS_API_KEY;
  const baseURL = 'https://api.propolis.tech'; 
  const baseUrlForTest = core.getInput('baseUrl', { required: false }); 

  const triggerRes = await axios.post(
    `${baseURL}/api/testing/runAllTestsInBatch`,
    { baseUrl: baseUrlForTest },
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
  const previousStatuses = new Map<string, string>();
  
  // Set timeout for 20 minutes (20 * 60 * 1000 ms)
  const timeoutMs = 20 * 60 * 1000;
  const startTime = Date.now();

  while (true) {
    // Check if we've exceeded the timeout
    if (Date.now() - startTime > timeoutMs) {
      core.warning('⏰ Timeout reached: Tests have been running for over 20 minutes. Propolis has been alerted. You can see the results in the Propolis UI.');
      core.setFailed('Test execution timed out after 20 minutes. Propolis has been alerted. You can see the results in the Propolis UI.');
      return;
    }
    
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

    const statuses = testRuns.map((r) => r.status);
    const counts = {
      queued: statuses.filter((s) => s === 'QUEUED').length,
      running: statuses.filter((s) => s === 'RUNNING' || s === 'NEEDS_MANUAL_REVIEW').length,
      completed: statuses.filter((s) => s === 'COMPLETED').length,
      failed: statuses.filter((s) => s === 'FAILED').length,
      agentError: statuses.filter((s) => s === 'AGENT_ERROR').length,
    };

    await core.group(
      `🌀 Poll #${pollCount} – ⏳ ${counts.queued} | 🏃 ${counts.running} | ✅ ${counts.completed} | ❌ ${counts.failed} | 🤖❌ ${counts.agentError}`,
      async () => {
        testRuns.forEach((t) => {
          const linkPart = ['COMPLETED', 'FAILED', 'AGENT_ERROR'].includes(t.status)
            ? ` (${t.url})`
            : '';
          const displayStatus = t.status === 'NEEDS_MANUAL_REVIEW' ? 'RUNNING' : t.status;
          core.info(`${statusIcon(t.status)} ${t.friendlyName} → ${displayStatus}${linkPart}`);
          previousStatuses.set(t.runId, t.status);
        });
      }
    );

    const allDone = statuses.every((s: string) =>
      ['COMPLETED', 'FAILED', 'AGENT_ERROR'].includes(s)
    );
    if (!allDone) {
      await sleep(10000);
      continue;
    }

    // All tests have finished – build a job summary once
    const summaryTable = testRuns.map((t) => {
      const displayStatus = t.status === 'NEEDS_MANUAL_REVIEW' ? 'RUNNING' : t.status;
      return [
        { data: statusIcon(t.status), header: false },
        t.friendlyName,
        displayStatus,
        `<a href="${t.url}">Logs</a>`,
      ];
    });

    await core.summary
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

    const failedTests = testRuns.filter((test) => test.status === 'FAILED' || test.status === 'AGENT_ERROR');
    const passedTests = testRuns.filter((test) => test.status === 'COMPLETED');
    
    if (failedTests.length > 0) {
      let errorMessage = '❌ The following test suites failed:\n';
      failedTests.forEach((test) => {
        errorMessage += `- Test ${test.friendlyName}: ${test.url}\n`;
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
