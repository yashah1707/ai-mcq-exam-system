const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:5174/login', { waitUntil: 'networkidle0' });
  await page.type('#login-email', 'admin@mit.edu');
  await page.type('#login-password', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });
  await page.goto('http://localhost:5174/admin/exams', { waitUntil: 'networkidle0' });
  const createBtn = await page.$x("//button[contains(text(), 'Create Exam') or contains(text(), 'Create New Exam') or contains(text(), '+ Create Exam')]");
  if (createBtn.length > 0) {
    await createBtn[0].click();
  } else {
    console.log('Create Exam button not found');
    await browser.close();
    return;
  }
  await page.waitForTimeout(1000);
  
  // Fill title
  const inputs = await page.$$('input[type="text"]');
  if (inputs.length > 0) {
    await inputs[0].type('Test Exam');
  }

  // Check a question
  const check = await page.$('input[type="checkbox"]');
  if (check) {
    await check.click();
  }
  
  await page.waitForTimeout(1000);
  
  // Click Create Exam to submit
  const submitBtn = await page.$x("//button[contains(text(), 'Create Exam') or contains(text(), 'Update Exam') or @type='submit']");
  if (submitBtn.length > 0) {
    await submitBtn[0].click();
  }
  
  await page.waitForTimeout(2000);
  
  // Check for error messages
  await page.screenshot({ path: 'c:\\Users\\shour\\ai-mcq-exam-system\\create_exam_error.png' });
  
  await browser.close();
})();
