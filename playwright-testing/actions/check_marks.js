async page => {
  await page.setViewportSize({ width: 1400, height: 900 }).catch(() => {});

  const menu = name => page.locator(`a[role="button"]:has-text("${name}")`).first();

  const loggedIn = await menu('Academics')
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true).catch(() => false);
  if (!loggedIn) return { error: 'not_logged_in' };

  const exam = menu('Examinations');
  if ((await exam.getAttribute('aria-expanded')) !== 'true') await exam.click();

  const marksLink = page.locator('a:visible').filter({ hasText: /^\s*Marks\s*$/ }).first();
  try {
    await marksLink.click({ timeout: 5000 });
  } catch {
    await page.getByRole('link', { name: /Marks/i }).last().click({ timeout: 5000 });
  }

  await page.getByText('Marks View').first().waitFor({ timeout: 10000 });

  const select = page.getByRole('combobox').first();
  await select.waitFor({ timeout: 5000 });
  const options = (await select.locator('option').allTextContents())
    .map(o => o.trim()).filter(o => o && !/choose/i.test(o));
  if (!options.length) return { error: 'no_semesters_found' };
  await select.selectOption(options[0]);

  await page.locator('table.customTable').first().waitFor({ timeout: 10000 });
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

  return await page.evaluate(() => {
    const parseNum = v => {
      if (!v) return null;
      const t = v.trim().toLowerCase();
      if (t === '' || t === '-' || t === 'absent' || t === 'null') return null;
      const n = parseFloat(t);
      return isNaN(n) ? null : n;
    };

    const table = document.querySelector('table.customTable');
    if (!table) return [];

    const courseRows = [...table.querySelectorAll('tr')].filter(tr => {
      const c = tr.querySelectorAll(':scope > td');
      return c.length >= 8 && /^[A-Z]{3,4}\d{3,4}[A-Z]?$/.test(c[2].textContent.trim());
    });

    return courseRows.map(row => {
      const c = row.querySelectorAll(':scope > td');
      const detail = row.nextElementSibling ? row.nextElementSibling.querySelector('table') : null;
      const assessments = [];

      if (detail) {
        detail.querySelectorAll('tr').forEach(tr => {
          const cols = [...tr.querySelectorAll('td')].map(x => x.textContent.trim());
          if (cols.length < 7 || !cols[1] || cols[1] === 'Mark Title') return;
          const absent = (cols[4] || '').toLowerCase() === 'absent';
          assessments.push({
            title: cols[1],
            max_mark: parseNum(cols[2]),
            weightage: parseNum(cols[3]),
            status: cols[4] || null,
            scored_mark: absent ? null : parseNum(cols[5]),
            weightage_mark: absent ? null : parseNum(cols[6])
          });
        });
      }

      return {
        course_code: c[2].textContent.trim(),
        course_title: c[3].textContent.trim(),
        assessments
      };
    });
  });
}
