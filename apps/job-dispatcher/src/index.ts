import { CronJob } from "cron";

const run = () => {
  console.log("Running managed providers");
};

const job = new CronJob("* * * * *", run);

console.log("Starting managed providers cronjob");
run();
job.start();
