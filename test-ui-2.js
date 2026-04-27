const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:5174/login', { waitUntil: 'networkidle0' });
  await page.type('#login-email', 'admin@mit.edu');
  await page.type('#login-password', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });
  
  await page.goto('http://localhost:5174/admin/exams', { waitUntil: 'networkidle0' });
  
  // Find Create Exam button
  const createBtn = await page.$x("//button[contains(text(), 'Create Exam') or contains(text(), 'Create New Exam') or contains(text(), '+ Create Exam') or contains(text(), 'Create one')]");
  if (createBtn.length > 0) {
    await createBtn[0].click();
  } else {
    // try finding the link 'Create one'
    const link = await page.$x("//a[contains(text(), 'Create one')]");
    if (link.length > 0) {
      await link[0].click();
    } else {
      console.log('No create button found');
      await browser.close();
      return;
    }
  }
  
  await page.waitForTimeout(1000);
  
  const inputs = await page.$$('input');
  if (inputs.length > 0) {
    await inputs[0].type('Test Exam');
  }

  const check = await page.$('input[type="checkbox"]');
  if (check) {
    await check.click();
  } else {
    console.log('No checkbox found');
  }
  
  await page.waitForTimeout(1000);
  
  // Dump the page HTML to see what's wrong
  const html = await page.content();
  require('fs').writeFileSync('c:\\Users\\shour\\ai-mcq-exam-system\\exams_html.txt', html);
  
  await browser.close();
})();
