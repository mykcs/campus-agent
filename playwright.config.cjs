const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
  testDir:'tests',testMatch:'site-design.spec.cjs',fullyParallel:true,forbidOnly:!!process.env.CI,retries:0,workers:2,
  reporter:[['list'],['html',{open:'never'}]],outputDir:'test-results/browser',
  // page.route fixtures must own reload requests as well as the initial page.
  // https://playwright.dev/docs/network#missing-network-events-and-service-workers
  use:{baseURL:'http://127.0.0.1:8882',serviceWorkers:'block',trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[{name:'chromium',use:{browserName:'chromium'}},{name:'webkit',use:{browserName:'webkit'}}],
  webServer:{command:'node scripts/serve-tests.cjs',url:'http://127.0.0.1:8882',reuseExistingServer:!process.env.CI}
});
