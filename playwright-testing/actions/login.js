async page => {
  const USER = process.env.VTOP_USER;
  const PASS = process.env.VTOP_PASS;
  const LOGIN_URL = 'https://vtop.vit.ac.in/vtop/';

  const username = page.locator('#username').first();
  const password = page.locator('#password').first();
  const captcha = page.locator('#captchaStr').first();
  const submit = page.getByRole('button', { name: 'Submit' }).first();
  const academics = page.locator('a[role="button"]:has-text("Academics")').first();

  const openStudentForm = async () => {
    if (!(await username.isVisible().catch(() => false))) {
      await page.evaluate(() => submitForm('stdForm')).catch(() => {});
      await username.waitFor({ state: 'visible', timeout: 5000 });
    }
  };

  const doAttempt = async () => {
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(800);
    await openStudentForm();
    await username.waitFor({ state: 'visible', timeout: 5000 });
    await username.fill(USER);
    await password.waitFor({ state: 'visible', timeout: 5000 });
    await password.fill(PASS);

    // If a captcha field exists, wait for the extension to fill it (max 20s).
    if (await captcha.isVisible().catch(() => false)) {
      let filled = false;
      const start = Date.now();
      while (Date.now() - start < 20000) {
        const val = await captcha.inputValue().catch(() => '');
        if (val && val.trim().length > 0) { filled = true; break; }
        await page.waitForTimeout(500);
      }
      if (!filled) throw new Error('captcha_not_filled');
    }

    await submit.click();

    // Proof of login: Academics menu visible, or navigated away from login.
    const academicsVisible = await academics.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
    const navigated = page.url().includes('/vtop/content');
    if (academicsVisible || navigated) return true;
    throw new Error('academics_not_visible');
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (await doAttempt()) return { status: 'logged_in' };
    } catch (e) {
      if (attempt === 3) return { error: 'login_failed' };
      await page.waitForTimeout(1200);
    }
  }
  return { error: 'login_failed' };
}
