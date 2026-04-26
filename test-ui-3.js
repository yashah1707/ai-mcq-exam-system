const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText));
  page.on('response', async response => {
    if (response.url().includes('/api/exams') && response.request().method() === 'POST') {
      try {
        console.log('EXAM CREATE RESPONSE:', response.status(), await response.text());
      } catch(e) {}
    }
  });

  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:5174/login', { waitUntil: 'networkidle0' });
  await page.type('#login-email', 'admin@example.com');
  await page.type('#login-password', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });
  
  await page.goto('http://localhost:5174/admin/exams', { waitUntil: 'networkidle0' });
  
  // Find Create Exam button
  const createBtn = await page.$x("//button[contains(text(), 'Create Exam') or contains(text(), 'Create New Exam') or contains(text(), '+ Create Exam') or contains(text(), 'Create one')]");
  if (createBtn.length > 0) {
    await createBtn[0].click();
  } else {
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
  
  // Title
  const inputs = await page.$$('input[type="text"]');
  if (inputs.length > 0) {
    await inputs[0].type('Test Exam');
  }

  // Checkbox
  const check = await page.$('input[type="checkbox"]');
  if (check) {
    await check.click();
  } else {
    console.log('No questions to check! Creating one inline...');
    // Create inline question
    await page.click('button:has-text("Quick Add Question")').catch(() => {});
    const textareas = await page.$$('textarea');
    if (textareas.length > 1) {
      await textareas[1].type('Inline test question');
    } else if (textareas.length > 0) {
      await textareas[0].type('Inline test question');
    }
    
    // The inline question form is shown by default if showInlineQuestionForm is true. Wait, is it?
    // Let's click "Save Question And Add To Exam"
    const saveQBtn = await page.$x("//button[contains(text(), 'Save Question And Add To Exam')]");
    if (saveQBtn.length > 0) {
      await saveQBtn[0].click();
      await page.waitForTimeout(1000);
    }
  }
  
  await page.waitForTimeout(1000);
  
  // Click submit
  const submitBtn = await page.$x("//button[contains(text(), 'Create Exam') and not(contains(text(), '+'))]");
  if (submitBtn.length > 0) {
    await submitBtn[0].click();
  } else {
    console.log('Submit button not found');
  }
  
  await page.waitForTimeout(2000);
  
  await browser.close();
})();
