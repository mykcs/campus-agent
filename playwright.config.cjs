const {defineConfig}=require('@playwright/test');
const port=process.env.CAMPUS_TEST_PORT||8882;
const baseURL='http://127.0.0.1:'+port;
module.exports=defineConfig({
  testDir:'tests',testMatch:'site-design.spec.cjs',fullyParallel:true,forbidOnly:!!process.env.CI,retries:0,workers:2,
  reporter:[['list'],['html',{open:'never'}]],outputDir:'test-results/browser',
  // page.route fixtures must own reload requests as well as the initial page.
  // https://playwright.dev/docs/network#missing-network-events-and-service-workers
  use:{baseURL,serviceWorkers:'block',trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[{name:'chromium',use:{browserName:'chromium'}},{name:'webkit',use:{browserName:'webkit'}}],
  webServer:{command:'node scripts/serve-tests.cjs',url:baseURL,reuseExistingServer:false}
});
