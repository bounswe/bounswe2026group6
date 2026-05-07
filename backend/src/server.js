const { createApp } = require('./app');
const { env } = require('./config/env');
const { startNotificationJobs } = require('./modules/notifications/jobs');

const app = createApp();

app.listen(env.appPort, () => {
  console.log(`Backend server listening on port ${env.appPort}`);
  startNotificationJobs();
});
