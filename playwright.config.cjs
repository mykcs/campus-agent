const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
  testDir:'tests',testMatch:'site-design.spec.cjs',fullyParallel:true,forbidOnly:!!process.env.CI,retries:0,workers:2,
  reporter:[['list'],['html',{open:'never'}]],outputDir:'test-results/browser',
  use:{baseURL:'http://127.0.0.1:8882',trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[{name:'chromium',use:{browserName:'chromium'}},{name:'webkit',use:{browserName:'webkit'}}],
  webServer:{command:'node scripts/serve-tests.cjs',url:'http://127.0.0.1:8882',reuseExistingServer:!process.env.CI}
});
