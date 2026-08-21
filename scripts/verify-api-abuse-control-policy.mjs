import {
  apiAbuseControlPolicy,
  validateApiAbuseControlPolicy,
} from '../server/apiAbuseControlPolicy.mjs';

const result = validateApiAbuseControlPolicy();
process.stdout.write(`${JSON.stringify({
  ...result,
  controls: Object.keys(apiAbuseControlPolicy).length,
})}\n`);
if (result.status !== 'passed') process.exitCode = 1;
