import { runJob } from './jobs.js';

self.onmessage = (e) => {
  const { result, transfer } = runJob(e.data);
  self.postMessage(result, transfer);
};
